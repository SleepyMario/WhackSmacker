#!/usr/bin/env bash
set -euo pipefail

export PATH=/usr/local/bin:/usr/bin:/bin

APP=${WHACKSMACKER_APP_ROOT:-$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)}
REPOSITORY=docker.io/sleepiestmario/whacksmacker
release_tag=${1:-}
smoke_container=
smoke_volume=
clean_docker_config=

log() {
  printf '[%s] %s\n' "$(date -Is)" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

cleanup() {
  status=$?
  trap - EXIT INT TERM HUP
  if [[ -n "$smoke_container" ]]; then docker rm -f "$smoke_container" >/dev/null 2>&1 || true; fi
  if [[ -n "$smoke_volume" ]]; then docker volume rm "$smoke_volume" >/dev/null 2>&1 || true; fi
  if [[ -n "$clean_docker_config" ]]; then rm -rf -- "$clean_docker_config"; fi
  exit "$status"
}

remote_digest() {
  DOCKER_CONFIG=$clean_docker_config docker manifest inspect --verbose "$1" | node -e '
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

smoke_image() {
  local image=$1 label=$2
  smoke_container="wsm-release-smoke-${label//[^A-Za-z0-9_.-]/-}-$$"
  smoke_volume="wsm-release-smoke-data-$$"
  docker volume create "$smoke_volume" >/dev/null
  docker run --detach --name "$smoke_container" \
    --mount "type=volume,source=$smoke_volume,target=/data" \
    "$image" web --host 0.0.0.0 --port 8787 --data-dir /data >/dev/null
  for _ in $(seq 1 60); do
    if docker exec "$smoke_container" node -e '
fetch("http://127.0.0.1:8787/api/health").then(async response => {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true || body?.service !== "whacksmacker-web") process.exit(1);
}).catch(() => process.exit(1));' >/dev/null 2>&1; then
      log "isolated smoke passed label=$label image=$image"
      docker rm -f "$smoke_container" >/dev/null
      docker volume rm "$smoke_volume" >/dev/null
      smoke_container=
      smoke_volume=
      return 0
    fi
    sleep 1
  done
  docker logs --tail 80 "$smoke_container" >&2 || true
  die "isolated smoke failed: $label"
}

trap cleanup EXIT INT TERM HUP

[[ "$#" -eq 1 ]] || die 'usage: whacksmacker-docker-release.sh RELEASE_TAG'
[[ "$release_tag" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$ ]] || die 'release tag must be an explicit semantic version such as 0.1.0-alpha.3'
[[ "$release_tag" != latest ]] || die 'manual releases may not use latest'
command -v git >/dev/null || die 'git is required'
command -v npm >/dev/null || die 'npm is required'
command -v docker >/dev/null || die 'docker is required'
[[ -d "$APP/.git" ]] || die "application checkout is missing: $APP"

cd "$APP"
source_revision=$(git rev-parse HEAD)
source_branch=$(git branch --show-current)
[[ -z "$(git status --porcelain)" ]] || die 'manual releases require a clean source checkout'
image="$REPOSITORY:$release_tag"
clean_docker_config=$(mktemp -d)

log "manual release authorized tag=$release_tag branch=$source_branch revision=$source_revision"
npm ci
npm audit --audit-level=high
npm run build
npm test

docker build \
  --label "org.opencontainers.image.revision=$source_revision" \
  --label "org.opencontainers.image.version=$release_tag" \
  --tag "$image" \
  .

built_revision=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")
built_version=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' "$image")
[[ "$built_revision" == "$source_revision" ]] || die 'built image source-revision label does not match source commit'
[[ "$built_version" == "$release_tag" ]] || die 'built image release label does not match the explicit release tag'
image_id=$(docker image inspect --format '{{.Id}}' "$image")
image_arch=$(docker image inspect --format '{{.Architecture}}/{{.Os}}' "$image")
log "validated image id=$image_id platform=$image_arch revision=$built_revision release=$built_version"
smoke_image "$image" local

log "pushing manually authorized release $image"
push_output=$(docker push "$image")
printf '%s\n' "$push_output"
pushed_digest=$(printf '%s\n' "$push_output" | sed -n 's/^.*digest: \(sha256:[0-9a-f]\{64\}\).*$/\1/p' | tail -n 1)
[[ -n "$pushed_digest" ]] || die 'docker push did not report a registry digest'
registry_digest=$(remote_digest "$image")
[[ "$registry_digest" == "$pushed_digest" ]] || die "remote digest mismatch: pushed=$pushed_digest registry=$registry_digest"

log 'pulling release with an empty Docker credential context'
DOCKER_CONFIG=$clean_docker_config docker pull "$image"
pulled_digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "$image")
[[ "$pulled_digest" == "$REPOSITORY@$registry_digest" ]] || die "clean-pull digest mismatch: pulled=$pulled_digest registry=$REPOSITORY@$registry_digest"
smoke_image "$image" remote

log "PASS manual release image=$image digest=$registry_digest revision=$source_revision"
log 'production deployment was not performed; use scripts/deploy-production.sh as a separate explicit action'
