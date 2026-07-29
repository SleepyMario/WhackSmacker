#!/usr/bin/env bash
set -euo pipefail

VM=gentoo-wsm-validate
VM_IP=192.168.122.159
HOST_USER=ashwin
VM_USER=ashwin
ROOT=/home/ashwin/Projects/whacksmacker-modules
REMOTE_ROOT=/home/ashwin/Projects/whacksmacker-modules
REMOTE_SCRIPT=/home/ashwin/bin/whacksmacker-docker-daily.sh
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
VIRSH=(sudo env LC_ALL=C LANG=C virsh -c qemu:///system)

log() {
  printf '[%s] %s\n' "$(date -Is)" "$*"
}

vm_state() {
  "${VIRSH[@]}" domstate "$VM" 2>/dev/null || true
}

vm_running() {
  [[ "$(vm_state)" == running ]]
}

shutdown_vm() {
  log "shutdown requested for $VM; current state=$(vm_state)"
  if ! vm_running; then
    log "$VM is not running; no shutdown needed"
    return 0
  fi
  "${VIRSH[@]}" shutdown "$VM" || true
  for _ in $(seq 1 60); do
    state=$(vm_state)
    if [[ "$state" == 'shut off' ]]; then
      log "$VM shut down cleanly"
      return 0
    fi
    sleep 5
  done
  log "$VM did not shut down cleanly; forcing power off"
  "${VIRSH[@]}" destroy "$VM" || true
  sleep 2
  log "final VM state=$(vm_state)"
}

cleanup_done=0
cleanup() {
  status=$?
  trap - EXIT INT TERM HUP
  if [[ "$cleanup_done" -eq 0 ]]; then
    cleanup_done=1
    log "trap cleanup running with exit code $status"
    shutdown_vm
  fi
  exit "$status"
}

wait_for_ssh() {
  log "waiting for SSH on $VM_IP"
  for _ in $(seq 1 120); do
    if sudo -u "$HOST_USER" -H ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new "$VM_USER@$VM_IP" true >/dev/null 2>&1; then
      log 'SSH is ready'
      return 0
    fi
    sleep 5
  done
  log "ERROR: SSH did not become ready on $VM_IP"
  return 1
}

sync_repos_to_vm() {
  sudo -u "$HOST_USER" -H ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$VM_USER@$VM_IP" "mkdir -p '$REMOTE_ROOT'"
  for repo in "${REPOS[@]}"; do
    local_path=$ROOT/$repo
    [[ -d "$local_path/.git" ]] || { log "ERROR: required local repository missing: $repo"; return 1; }
    status=$(git -C "$local_path" status --porcelain)
    [[ -z "$status" ]] || { log "ERROR: required local repository is dirty: $repo"; return 1; }
    revision=$(git -C "$local_path" rev-parse HEAD)
    log "syncing repository=$repo revision=$revision"
    sudo -u "$HOST_USER" -H rsync -a --delete \
      --exclude node_modules \
      --exclude dist \
      --exclude .cache \
      --exclude coverage \
      "$local_path" "$VM_USER@$VM_IP:$REMOTE_ROOT/"
    remote_revision=$(sudo -u "$HOST_USER" -H ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$VM_USER@$VM_IP" "git -C '$REMOTE_ROOT/$repo' rev-parse HEAD")
    [[ "$remote_revision" == "$revision" ]] || { log "ERROR: synchronized revision mismatch for $repo"; return 1; }
    remote_status=$(sudo -u "$HOST_USER" -H ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$VM_USER@$VM_IP" "git -C '$REMOTE_ROOT/$repo' status --porcelain")
    [[ -z "$remote_status" ]] || { log "ERROR: synchronized repository is dirty: $repo"; return 1; }
    log "synchronized repository=$repo revision=$remote_revision"
  done
  log "repository synchronization inventory: ${REPOS[*]}"
}

trap cleanup EXIT INT TERM HUP

log "starting daily snapshot orchestrator for $VM"
"${VIRSH[@]}" list --all
if ! vm_running; then "${VIRSH[@]}" start "$VM"; else log "$VM is already running"; fi
wait_for_ssh
sync_repos_to_vm
log "running remote daily script=$REMOTE_SCRIPT"
sudo -u "$HOST_USER" -H ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$VM_USER@$VM_IP" "$REMOTE_SCRIPT"
log 'remote build and push finished'

cleanup_done=1
trap - EXIT INT TERM HUP
shutdown_vm
log 'daily snapshot orchestrator finished'
