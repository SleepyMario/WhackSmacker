#!/usr/bin/env bash
set -euo pipefail

export PATH=/usr/local/bin:/usr/bin:/bin

APP=${WHACKSMACKER_APP_ROOT:-/home/ashwin/Projects/whacksmacker-modules/whacksmacker}
IMAGE_REMOTE=docker.io/sleepiestmario/whacksmacker:latest
ALLOW_DIRTY=${WHACKSMACKER_ALLOW_DIRTY:-0}

log() {
  printf '[%s] %s\n' "$(date -Is)" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

remote_digest() {
  docker manifest inspect --verbose "$1" | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const value = JSON.parse(input);
  const descriptor = Array.isArray(value) ? value[0]?.Descriptor : value.Descriptor;
  if (!descriptor?.digest) process.exit(1);
  process.stdout.write(descriptor.digest);
});'
}

command -v git >/dev/null || die 'git is required'
command -v npm >/dev/null || die 'npm is required'
command -v docker >/dev/null || die 'docker is required'
[[ -d "$APP/.git" ]] || die "application checkout is missing: $APP"

cd "$APP"
source_revision=$(git rev-parse HEAD)
source_branch=$(git branch --show-current)
source_status=$(git status --porcelain)
if [[ -n "$source_status" && "$ALLOW_DIRTY" != 1 ]]; then
  die 'source checkout is dirty; set WHACKSMACKER_ALLOW_DIRTY=1 only for an explicitly authorized nonstandard run'
fi
if [[ -n "$source_status" ]]; then
  log 'WARNING: explicitly authorized dirty-source build'
fi

log "daily snapshot source branch=$source_branch revision=$source_revision dirty=$([[ -n "$source_status" ]] && printf yes || printf no)"
log 'installing exact npm dependencies'
npm ci
log 'auditing high-severity npm vulnerabilities'
npm audit --audit-level=high
log 'building application'
npm run build
log 'running application tests'
npm test

log "building $IMAGE_REMOTE"
docker build \
  --label "org.opencontainers.image.revision=$source_revision" \
  --label 'org.opencontainers.image.version=latest' \
  --tag "$IMAGE_REMOTE" \
  .

built_revision=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$IMAGE_REMOTE")
built_version=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' "$IMAGE_REMOTE")
[[ "$built_revision" == "$source_revision" ]] || die 'built image source-revision label does not match source commit'
[[ "$built_version" == latest ]] || die 'built image version label is not latest'
image_id=$(docker image inspect --format '{{.Id}}' "$IMAGE_REMOTE")
image_arch=$(docker image inspect --format '{{.Architecture}}/{{.Os}}' "$IMAGE_REMOTE")
image_created=$(docker image inspect --format '{{.Created}}' "$IMAGE_REMOTE")
log "built image id=$image_id platform=$image_arch created=$image_created revision=$built_revision"

log "pushing $IMAGE_REMOTE"
push_output=$(docker push "$IMAGE_REMOTE")
printf '%s\n' "$push_output"
pushed_digest=$(printf '%s\n' "$push_output" | sed -n 's/^.*digest: \(sha256:[0-9a-f]\{64\}\).*$/\1/p' | tail -n 1)
[[ -n "$pushed_digest" ]] || die 'docker push did not report a registry digest'
registry_digest=$(remote_digest "$IMAGE_REMOTE")
[[ "$registry_digest" == "$pushed_digest" ]] || die "remote digest mismatch: pushed=$pushed_digest registry=$registry_digest"

log "PASS daily snapshot image=$IMAGE_REMOTE digest=$registry_digest revision=$source_revision"
