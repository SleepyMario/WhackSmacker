#!/usr/bin/env bash
set -euo pipefail

VM_NAME="gentoo-wsm"
VM_ID="102"
VM_HOST="gentoo-wsm"
PM_HOST="thinkpad"
HOST_USER="ashwin"
ROOT="/home/ashwin/Projects/whacksmacker-modules"
REMOTE_ROOT=""
STAGING_ROOT=""
PREPARE_ONLY=0
VALIDATE_ONLY=0
BUILD_ONLY=0
case "${1:-}" in
  --prepare-only) PREPARE_ONLY=1 ;;
  --validate-only) VALIDATE_ONLY=1 ;;
  --build-only) BUILD_ONLY=1 ;;
  "") ;;
  *) echo "Usage: $0 [--prepare-only|--validate-only|--build-only]" >&2; exit 2 ;;
esac
REMOTE_SCRIPT="/home/ashwin/bin/whacksmacker-docker-daily.sh"
MAIL_TO="admin@sleepymario.com"
MAIL_FROM="slacktop <slacktop@sleepymario.com>"
NIGHT_LOCK="/run/lock/proxmox-vm-nightly.lock"
DOCKER_HUB_REPOSITORY="sleepiestmario/whacksmacker"
DOCKER_HUB_TAG="latest"
REPOS=(
  whacksmacker
  language-learning-curriculum-builder
  linguistic-terminology
  language-curriculum-specialized
  arabic-curriculum
  chinese-curriculum
  dutch-curriculum
  english-curriculum
  french-curriculum
  german-curriculum
  hindi-curriculum
  japanese-curriculum
  korean-curriculum
  russian-curriculum
  spanish-curriculum
  thai-curriculum
  vietnamese-curriculum
  zulu-curriculum
)

SSH_OPTIONS=(
  -o BatchMode=yes
  -o ConnectTimeout=5
  -o StrictHostKeyChecking=accept-new
)

log() {
  printf '[%s] %s\n' "$(date -Is)" "$*"
}

docker_hub_snapshot() {
  /usr/bin/curl -fsSL --retry 3 --connect-timeout 10 \
    "https://hub.docker.com/v2/repositories/$DOCKER_HUB_REPOSITORY/tags/$DOCKER_HUB_TAG" | \
    /usr/bin/python3 -c 'import json, sys; d=json.load(sys.stdin); print("{}|{}".format(d.get("digest", "unknown"), d.get("tag_last_pushed") or d.get("last_updated") or "unknown"))'
}

report_docker_hub_result() {
  local after after_digest after_pushed before_digest before_pushed

  DOCKER_HUB_REPORTED=1
  if ! after="$(docker_hub_snapshot)"; then
    log "WARNING: unable to read Docker Hub metadata after the job"
    return 0
  fi

  before_digest="${DOCKER_HUB_BEFORE%%|*}"
  before_pushed="${DOCKER_HUB_BEFORE#*|}"
  after_digest="${after%%|*}"
  after_pushed="${after#*|}"
  log "Docker Hub after: repository=$DOCKER_HUB_REPOSITORY tag=$DOCKER_HUB_TAG digest=$after_digest last_pushed=$after_pushed"

  if [[ -z "$DOCKER_HUB_BEFORE" ]]; then
    log "Docker Hub result: post-job state recorded; no pre-job state was available for comparison"
  elif [[ "$after_digest" != "$before_digest" ]]; then
    log "Docker Hub result: NEW IMAGE PUBLISHED (digest changed)"
  elif [[ "$after_pushed" != "$before_pushed" ]]; then
    log "Docker Hub result: identical image digest; Docker Hub refreshed the tag timestamp"
  elif [[ "$BUILD_PUSH_COMPLETED" -eq 1 ]]; then
    log "Docker Hub result: pipeline produced the existing identical image; digest and last_pushed are unchanged"
  else
    log "Docker Hub result: job stopped before a new image was published; digest and last_pushed are unchanged"
  fi
}

RUN_LOG="$(mktemp /tmp/whacksmacker-docker-vm-daily.XXXXXX.log)"
exec > >(tee -a "$RUN_LOG") 2>&1

send_report() {
  local rc="$1" result="SUCCESS"
  if (( PREPARE_ONLY || VALIDATE_ONLY || BUILD_ONLY )); then
    log "Validation finished with exit $rc; no email sent"
    return 0
  fi
  [[ "$rc" -eq 0 ]] || result="FAILURE"
  /usr/bin/mail -r "$MAIL_FROM" -s "[$result] WhackSmacker daily Docker build on $(hostname)" \
    "$MAIL_TO" < "$RUN_LOG" || true
  rm -f "$RUN_LOG"
}

pm_qm() {
  sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$PM_HOST" -- qm "$@"
}

vm_state() {
  pm_qm status "$VM_ID" 2>/dev/null | awk -F': ' '/^status: / { print $2 }'
}

shutdown_vm() {
  local state
  state="$(vm_state)"
  log "Shutdown requested for Proxmox VM $VM_ID ($VM_NAME); current state=$state"

  if [[ "$state" != "running" ]]; then
    log "$VM_NAME is not running; no shutdown needed"
    return 0
  fi

  if pm_qm shutdown "$VM_ID" --timeout 300 --forceStop 0; then
    log "$VM_NAME shut down cleanly"
    return 0
  fi

  state="$(vm_state)"
  if [[ "$state" == "running" ]]; then
    log "ERROR: clean shutdown timed out; leaving VM $VM_ID running for inspection"
    return 1
  fi
}

started_by_script=0
cleanup_done=0
DOCKER_HUB_BEFORE=""
DOCKER_HUB_REPORTED=0
BUILD_PUSH_COMPLETED=0

cleanup() {
  local rc=$?
  trap - EXIT INT TERM HUP

  if [[ "$DOCKER_HUB_REPORTED" -eq 0 ]]; then
    report_docker_hub_result || true
  fi

  if [[ -n "$REMOTE_ROOT" && "$REMOTE_ROOT" =~ ^/home/ashwin/\.cache/wsm-daily-source\.[A-Za-z0-9]+$ ]]; then
    sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" "rm -rf -- '$REMOTE_ROOT'" || log "WARNING: could not remove disposable build directory $REMOTE_ROOT"
    REMOTE_ROOT=""
  fi

  if [[ "$cleanup_done" -eq 0 && "$started_by_script" -eq 1 ]]; then
    cleanup_done=1
    log "Failure cleanup running with exit code $rc"
    shutdown_vm || true
  fi

  if [[ -n "$STAGING_ROOT" && "$STAGING_ROOT" == /tmp/wsm-daily-source.* ]]; then
    rm -rf -- "$STAGING_ROOT"
  fi
  if [[ -n "$REMOTE_ROOT" && "$REMOTE_ROOT" == /home/ashwin/.cache/wsm-daily-source.* ]]; then
    log "Build source retained in $VM_HOST:$REMOTE_ROOT for inspection"
  fi
  send_report "$rc"
  exit "$rc"
}

wait_for_ssh() {
  log "Waiting for SSH on $VM_HOST"
  for _ in $(seq 1 120); do
    if sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" true >/dev/null 2>&1; then
      log "SSH is ready"
      return 0
    fi
    sleep 5
  done
  log "ERROR: SSH did not become ready on $VM_HOST"
  return 1
}

ensure_vm_idle() {
  local details

  details="$(sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" \
    'ps -eo pid=,comm=,args= | awk '\''$2 ~ /^(emerge|ninja|cc1plus|docker-buildx)$/ || ($2 == "docker" && $3 ~ /^(build|buildx|push)$/) { print }'\''')"
  if [[ -n "$details" ]]; then
    log "ERROR: $VM_NAME already has package/build work in progress; refusing to overlap it"
    printf '%s\n' "$details"
    return 1
  fi

  log "No conflicting package or container build is running in $VM_NAME"
}

prepare_committed_repos() {
  local repo local_path revision staged_revision status
  STAGING_ROOT="$(sudo -u "$HOST_USER" -H mktemp -d /tmp/wsm-daily-source.XXXXXXXX)"
  for repo in "${REPOS[@]}"; do
    local_path="$ROOT/$repo"
    revision="$(sudo -u "$HOST_USER" -H git -C "$local_path" rev-parse --verify HEAD)"
    status="$(sudo -u "$HOST_USER" -H git -C "$local_path" status --porcelain)"
    if [[ -n "$status" ]]; then
      log "repository=$repo has working edits; building committed revision=$revision only"
    fi
    # A shallow independent clone copies committed objects only. Never stash/reset the user's tree.
    sudo -u "$HOST_USER" -H git clone --quiet --no-local --depth 1 --no-checkout \
      "$local_path" "$STAGING_ROOT/$repo"
    sudo -u "$HOST_USER" -H git -C "$STAGING_ROOT/$repo" checkout --quiet --detach "$revision"
    staged_revision="$(sudo -u "$HOST_USER" -H git -C "$STAGING_ROOT/$repo" rev-parse HEAD)"
    [[ "$staged_revision" == "$revision" ]] || return 1
    [[ -z "$(sudo -u "$HOST_USER" -H git -C "$STAGING_ROOT/$repo" status --porcelain)" ]] || return 1
    log "Prepared clean repository=$repo revision=$revision"
  done
}

sync_repos_to_vm() {
  local repo revision remote_revision
  REMOTE_ROOT="$(sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" \
    'mkdir -p /home/ashwin/.cache && mktemp -d /home/ashwin/.cache/wsm-daily-source.XXXXXXXX')"
  [[ "$REMOTE_ROOT" =~ ^/home/ashwin/\.cache/wsm-daily-source\.[A-Za-z0-9]+$ ]] || return 1
  # Unique destination: existing VM working trees are never overwritten or deleted.
  sudo -u "$HOST_USER" -H rsync -a \
    -e "ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new" \
    "$STAGING_ROOT/" "$VM_HOST:$REMOTE_ROOT/"
  for repo in "${REPOS[@]}"; do
    revision="$(sudo -u "$HOST_USER" -H git -C "$STAGING_ROOT/$repo" rev-parse HEAD)"
    remote_revision="$(sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" "git -C '$REMOTE_ROOT/$repo' rev-parse HEAD")"
    [[ "$remote_revision" == "$revision" ]] || return 1
    [[ -z "$(sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" "git -C '$REMOTE_ROOT/$repo' status --porcelain")" ]] || return 1
    log "Verified build input repository=$repo revision=$revision"
  done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

exec 9>"$NIGHT_LOCK"
if ! flock -n 9; then
  log "ERROR: another overnight Proxmox job holds $NIGHT_LOCK; refusing to overlap"
  exit 1
fi
log "Acquired overnight Proxmox job lock"

if (( PREPARE_ONLY || VALIDATE_ONLY || BUILD_ONLY )); then
  DOCKER_HUB_REPORTED=1
elif DOCKER_HUB_BEFORE="$(docker_hub_snapshot)"; then
  log "Docker Hub before: repository=$DOCKER_HUB_REPOSITORY tag=$DOCKER_HUB_TAG digest=${DOCKER_HUB_BEFORE%%|*} last_pushed=${DOCKER_HUB_BEFORE#*|}"
else
  DOCKER_HUB_BEFORE=""
  log "WARNING: unable to read Docker Hub metadata before the job"
fi

prepare_committed_repos
if (( PREPARE_ONLY )); then
  log "PASS: committed-source preparation; no VM, build, publication or mail"
  exit 0
fi

state="$(vm_state)"
log "Proxmox VM $VM_ID ($VM_NAME) state=$state"
case "$state" in
  stopped)
    pm_qm start "$VM_ID"
    started_by_script=1
    ;;
  running)
    log "$VM_NAME was already running; it will be left running after this job"
    ;;
  *)
    log "ERROR: unexpected Proxmox VM state: $state"
    exit 1
    ;;
esac

wait_for_ssh
ensure_vm_idle
sync_repos_to_vm

if (( VALIDATE_ONLY )); then
  log "PASS: all committed build inputs verified in the designated VM; no build/publication"
  exit 0
fi

log "Running remote WhackSmacker build/push script"
sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" "WHACKSMACKER_VALIDATE_ONLY=$BUILD_ONLY WHACKSMACKER_APP_ROOT='$REMOTE_ROOT/whacksmacker' '$REMOTE_SCRIPT'"
log "Remote build/push finished"
if (( ! BUILD_ONLY )); then
  BUILD_PUSH_COMPLETED=1
  report_docker_hub_result
fi

if [[ -n "$REMOTE_ROOT" ]]; then
  sudo -u "$HOST_USER" -H ssh "${SSH_OPTIONS[@]}" "$VM_HOST" "rm -rf -- '$REMOTE_ROOT'"
  REMOTE_ROOT=""
fi

if [[ "$started_by_script" -eq 1 ]]; then
  shutdown_vm
fi
cleanup_done=1
log "Script finished"
