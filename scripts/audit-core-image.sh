#!/bin/sh
set -eu
image="${1:?usage: audit-core-image.sh IMAGE}"
container="$(docker create "$image")"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker export "$container" > /tmp/whacksmacker-core-image.tar
if tar -tf /tmp/whacksmacker-core-image.tar | grep -E '/units/|grammar-(easy|hard)|/chapter\.md$|LICENSE-CONTENT' >/dev/null; then
  echo "prohibited reading curriculum material found in core image" >&2
  exit 1
fi
tar -xOf /tmp/whacksmacker-core-image.tar app/review-content/dutch/review-decks/chapter-021-025/cards.tsv >/dev/null
rm -rf /tmp/whacksmacker-core-audit
mkdir -p /tmp/whacksmacker-core-audit
tar -xf /tmp/whacksmacker-core-image.tar -C /tmp/whacksmacker-core-audit core-feed/packages
for package in /tmp/whacksmacker-core-audit/core-feed/packages/*.wspkg; do
  unzip -p "$package" manifest.json | grep '"spdx": "GPL-3.0-or-later"' >/dev/null
  if unzip -l "$package" | grep -E 'units/|/chapter\.md$|grammar-(easy|hard)|LICENSE-CONTENT' >/dev/null; then
    echo "reading content found inside core review package: $package" >&2; exit 1
  fi
done
echo "core image audit passed: no separated reading content; bundled reviews present"
