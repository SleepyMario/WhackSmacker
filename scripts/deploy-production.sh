#!/bin/sh
set -eu

umask 077

compose_file=compose.production.yaml
env_file=.env.production
backup_root=.deploy-backups
timeout=180
poll_interval=2
public_url=${WHACKSMACKER_DEPLOY_PUBLIC_URL:-}
core_image=
curricula_image=
validate_only=false
deployment_succeeded=false
rollback_armed=false
rollback_in_progress=false
backup_dir=
previous_core_image=
previous_curricula_image=

usage() {
  cat <<'EOF'
usage: deploy-production.sh [OPTIONS]

Deploy options:
  --core-image IMAGE          New WhackSmacker core image (required)
  --curricula-image IMAGE     New curricula image (required)
  --public-url URL            Also verify this public /api/health endpoint
  --validate-only             Verify the current deployment without changing it

Configuration:
  --compose-file FILE         Active Compose file (default: compose.production.yaml)
  --env-file FILE             Protected deployment env file (default: .env.production)
  --backup-dir DIRECTORY      Backup parent (default: .deploy-backups)
  --timeout SECONDS           Health timeout (default: 180)
  --poll-interval SECONDS     Health polling interval (default: 2)
  --help                      Show this help

WHACKSMACKER_DEPLOY_PUBLIC_URL may supply the optional public URL. The script
never checks host-side 127.0.0.1:8787 and never removes named volumes.
EOF
}

die() {
  printf 'deployment error: %s\n' "$1" >&2
  exit 1
}

is_nonnegative_integer() {
  case $1 in
    ''|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case $1 in
    --core-image) [ "$#" -ge 2 ] || die "--core-image requires a value"; core_image=$2; shift 2 ;;
    --curricula-image) [ "$#" -ge 2 ] || die "--curricula-image requires a value"; curricula_image=$2; shift 2 ;;
    --public-url) [ "$#" -ge 2 ] || die "--public-url requires a value"; public_url=$2; shift 2 ;;
    --compose-file) [ "$#" -ge 2 ] || die "--compose-file requires a value"; compose_file=$2; shift 2 ;;
    --env-file) [ "$#" -ge 2 ] || die "--env-file requires a value"; env_file=$2; shift 2 ;;
    --backup-dir) [ "$#" -ge 2 ] || die "--backup-dir requires a value"; backup_root=$2; shift 2 ;;
    --timeout) [ "$#" -ge 2 ] || die "--timeout requires a value"; timeout=$2; shift 2 ;;
    --poll-interval) [ "$#" -ge 2 ] || die "--poll-interval requires a value"; poll_interval=$2; shift 2 ;;
    --validate-only) validate_only=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

is_nonnegative_integer "$timeout" || die "timeout must be a non-negative integer"
is_nonnegative_integer "$poll_interval" || die "poll interval must be a non-negative integer"
[ -r "$compose_file" ] || die "cannot read Compose file: $compose_file"
[ -r "$env_file" ] || die "cannot read deployment env file: $env_file"
command -v docker >/dev/null 2>&1 || die "docker is required"

compose_dir=$(CDPATH= cd -- "$(dirname -- "$compose_file")" && pwd)
compose_file=$compose_dir/$(basename -- "$compose_file")
env_dir=$(CDPATH= cd -- "$(dirname -- "$env_file")" && pwd)
env_file=$env_dir/$(basename -- "$env_file")

compose() {
  docker compose --project-directory "$compose_dir" --env-file "$env_file" -f "$compose_file" "$@"
}

compose version >/dev/null 2>&1 || die "Docker Compose is unavailable"
compose config --quiet >/dev/null || die "Compose configuration is invalid"

container_id_for() {
  compose ps --all -q "$1" 2>/dev/null | sed -n '1p'
}

container_image() {
  docker inspect --format '{{.Config.Image}}' "$1" 2>/dev/null
}

diagnose_app() {
  app_id=$(container_id_for app || true)
  printf '%s\n' '--- app deployment diagnostics ---' >&2
  if [ -z "$app_id" ]; then
    printf '%s\n' 'container state: app container does not exist' >&2
  else
    docker inspect --format 'container state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} image={{.Config.Image}}' "$app_id" >&2 || true
    printf '%s\n' 'recent health-check records:' >&2
    docker inspect --format '{{if .State.Health}}{{range .State.Health.Log}}{{.End}} exit={{.ExitCode}} {{printf "%.240s" .Output}}{{println}}{{end}}{{else}}none{{end}}' "$app_id" >&2 || true
  fi
  printf '%s\n' 'recent app logs:' >&2
  compose logs --no-color --tail 80 app >&2 || true
  printf '%s\n' '--- end diagnostics ---' >&2
}

verify_in_container() {
  url=$1
  compose exec -T app node -e '
const url = process.argv[1];
const timer = setTimeout(() => process.exit(1), 10000);
fetch(url).then(async (response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true || body?.service !== "whacksmacker-web") process.exit(1);
  clearTimeout(timer);
}).catch(() => process.exit(1));
' "$url" >/dev/null
}

public_health_url() {
  case $public_url in
    */api/health) printf '%s\n' "$public_url" ;;
    *) printf '%s/api/health\n' "${public_url%/}" ;;
  esac
}

wait_for_app_health() {
  label=$1
  deadline=$(( $(date +%s) + timeout ))
  while :; do
    app_id=$(container_id_for app || true)
    if [ -n "$app_id" ]; then
      state=$(docker inspect --format '{{.State.Status}}' "$app_id" 2>/dev/null || printf unknown)
      health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$app_id" 2>/dev/null || printf unknown)
      case $state in
        exited|dead|removing) diagnose_app; printf '%s\n' "$label app exited unexpectedly (state=$state)" >&2; return 1 ;;
      esac
      case $health in
        healthy)
          if verify_in_container 'http://127.0.0.1:8787/api/health'; then
            return 0
          fi
          diagnose_app
          printf '%s\n' "$label in-container /api/health response was invalid" >&2
          return 1
          ;;
        unhealthy)
          diagnose_app
          printf '%s\n' "$label app is unhealthy" >&2
          return 1
          ;;
      esac
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      diagnose_app
      printf '%s\n' "$label app health timed out after ${timeout}s" >&2
      return 1
    fi
    sleep "$poll_interval"
  done
}

rollback() {
  rollback_in_progress=true
  rollback_ok=true
  printf '%s\n' "deployment incomplete; rolling back (backups retained at $backup_dir)" >&2
  if ! cp -p "$backup_dir/environment.before" "$env_file"; then
    printf '%s\n' 'rollback could not restore the prior environment file' >&2
    rollback_ok=false
  fi
  if ! WHACKSMACKER_IMAGE=$previous_core_image WHACKSMACKER_CURRICULA_IMAGE=$previous_curricula_image compose up -d; then
    printf '%s\n' 'rollback Compose restart failed' >&2
    rollback_ok=false
  elif ! wait_for_app_health 'rollback'; then
    rollback_ok=false
  fi
  if [ "$rollback_ok" = true ]; then
    printf '%s\n' "rollback succeeded; restored core=$previous_core_image curricula=$previous_curricula_image" >&2
  else
    printf '%s\n' "ROLLBACK FAILED; diagnostics and backups retained at $backup_dir" >&2
  fi
  rollback_in_progress=false
  [ "$rollback_ok" = true ]
}

on_exit() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$rollback_armed" = true ] && [ "$deployment_succeeded" != true ] && [ "$rollback_in_progress" != true ]; then
    if ! rollback; then status=1; fi
    [ "$status" -ne 0 ] || status=1
  fi
  exit "$status"
}

trap on_exit EXIT
trap 'exit 130' HUP INT
trap 'exit 143' TERM

if [ "$validate_only" = true ]; then
  wait_for_app_health 'validation' || exit 1
  if [ -n "$public_url" ]; then verify_in_container "$(public_health_url)" || die "public /api/health response was invalid"; fi
  deployment_succeeded=true
  printf '%s\n' 'deployment validation succeeded'
  exit 0
fi

[ -n "$core_image" ] || die "--core-image is required unless --validate-only is used"
[ -n "$curricula_image" ] || die "--curricula-image is required unless --validate-only is used"
case "$core_image$curricula_image" in *'
'*) die 'image references must not contain newlines' ;; esac

previous_app_id=$(container_id_for app || true)
previous_curricula_id=$(container_id_for curricula || true)
[ -n "$previous_app_id" ] || die 'preflight requires the current app container to exist'
[ -n "$previous_curricula_id" ] || die 'preflight requires the current curricula container to exist'
previous_core_image=$(container_image "$previous_app_id")
previous_curricula_image=$(container_image "$previous_curricula_id")
[ -n "$previous_core_image" ] || die 'could not resolve the current core image reference'
[ -n "$previous_curricula_image" ] || die 'could not resolve the current curricula image reference'

stamp=$(date -u +%Y%m%dT%H%M%SZ)-$$
backup_dir=$backup_root/$stamp
mkdir -p "$backup_dir"
cp -p "$env_file" "$backup_dir/environment.before"
candidate_env=$backup_dir/environment.candidate
awk -v core="$core_image" -v curricula="$curricula_image" '
BEGIN { core_seen=0; curricula_seen=0 }
/^WHACKSMACKER_IMAGE=/ { print "WHACKSMACKER_IMAGE=" core; core_seen=1; next }
/^WHACKSMACKER_CURRICULA_IMAGE=/ { print "WHACKSMACKER_CURRICULA_IMAGE=" curricula; curricula_seen=1; next }
{ print }
END {
  if (!core_seen) print "WHACKSMACKER_IMAGE=" core
  if (!curricula_seen) print "WHACKSMACKER_CURRICULA_IMAGE=" curricula
}
' "$env_file" > "$candidate_env"
chmod 600 "$candidate_env"

rollback_armed=true
cp -p "$candidate_env" "$env_file"
compose up -d
wait_for_app_health 'deployment' || exit 1
if [ -n "$public_url" ]; then
  verify_in_container "$(public_health_url)" || die "public /api/health response was invalid"
fi
deployment_succeeded=true
printf '%s\n' "deployment succeeded; backups retained at $backup_dir"
