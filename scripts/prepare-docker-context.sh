#!/usr/bin/env bash
set -euo pipefail
APP=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
[[ $# -eq 1 && -d "$1" ]] || { echo 'usage: prepare-docker-context.sh EMPTY_DIRECTORY' >&2; exit 2; }
CONTEXT=$(cd -- "$1" && pwd)
[[ -z "$(find "$CONTEXT" -mindepth 1 -maxdepth 1 -print -quit)" ]] || { echo 'context must be empty' >&2; exit 1; }
[[ -z "$(git -C "$APP" status --porcelain)" ]] || { echo 'Docker export requires clean committed application source' >&2; exit 1; }
mkdir "$CONTEXT/whacksmacker"
git -C "$APP" archive HEAD | tar -x -C "$CONTEXT/whacksmacker"
# Git archive excludes all untracked local data and the Git object database.
cd "$APP"
WHACKSMACKER_CORE_PACKAGE_BASE_URL=file:///core-feed/packages/ SOURCE_DATE_EPOCH=$(git show -s --format=%ct HEAD) node scripts/build-core-review-feed.mjs "$CONTEXT/core-feed"
# Fail closed on private runtime state even if it was accidentally committed.
if find "$CONTEXT" \( -name .git -o -name .local-content -o -name review-progress.json -o -name registry.json \) -print -quit | grep -q .; then
  echo 'private state detected in Docker context' >&2; exit 1
fi
