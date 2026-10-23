#!/usr/bin/env bash
set -euo pipefail

APP="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
FEED="${WSM_CATALOGUE:-$(dirname "$APP")/whacksmacker-packages/catalogue.json}"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/whacksmacker"
BUILD_STAMP="$DATA/cache/launcher-build.sha256"

# Keep reset curricula visible as reminders, but skip their automatic installation.
# Specialized decks are independent and remain available.
SOURCE_FEED="$FEED"
FEED="$DATA/cache/launcher-catalogue.json"
mkdir -p "$(dirname "$FEED")"
node "$APP/scripts/prepare-launcher-catalogue.mjs" "$SOURCE_FEED" "$FEED"

perf_now() {
  node -e 'process.stdout.write((Number(process.hrtime.bigint()) / 1e6).toString())'
}

perf_finish() {
  [[ "${WSM_PERF:-0}" == "1" ]] || return 0
  local name="$1"
  local started="$2"
  local origin="$3"
  node -e '
    const fs = require("node:fs");
    const now = Number(process.hrtime.bigint()) / 1e6;
    const event = JSON.stringify({ type: "span", name: process.argv[1], elapsedMs: now - Number(process.argv[3]), durationMs: now - Number(process.argv[2]), metadata: { component: "launcher" } });
    const file = process.env.WSM_PERF_FILE?.trim();
    if (file) fs.appendFileSync(file, `${event}\n`, "utf8"); else process.stderr.write(`${event}\n`);
  ' "$name" "$started" "$origin"
}

LAUNCHER_ORIGIN=""
if [[ "${WSM_PERF:-0}" == "1" ]]; then
  LAUNCHER_ORIGIN="$(perf_now)"
fi

cd "$APP"

BUILD_STARTED="${LAUNCHER_ORIGIN:-0}"
mkdir -p "$(dirname "$BUILD_STAMP")"
SOURCE_FINGERPRINT="$({
  find "$APP/apps" "$APP/packages" "$APP/src" "$APP/scripts" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' \) -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 sha256sum
  sha256sum "$APP/package.json" "$APP/package-lock.json" "$APP/tsconfig.json"
} | sha256sum | cut -d ' ' -f 1)"
PREVIOUS_FINGERPRINT="$(test -f "$BUILD_STAMP" && sed -n '1p' "$BUILD_STAMP" || true)"
if [[ "${WSM_FORCE_BUILD:-0}" == "1" || ! -f "$APP/dist/main.js" || "$SOURCE_FINGERPRINT" != "$PREVIOUS_FINGERPRINT" ]]; then
  printf 'WhackSmacker launcher: rebuilding application%s.\n' "$([[ "${WSM_FORCE_BUILD:-0}" == "1" ]] && printf ' (forced)' || true)" >&2
  npm run build >/dev/null
  printf '%s\n' "$SOURCE_FINGERPRINT" >"$BUILD_STAMP"
else
  printf 'WhackSmacker launcher: build is current.\n' >&2
fi
perf_finish "launcher.build" "$BUILD_STARTED" "${LAUNCHER_ORIGIN:-0}"

[[ -f "$FEED" ]] || {
  printf "Catalogue not found: %s\n" "$FEED" >&2
  exit 1
}

INSPECTION_STARTED="$(if [[ -n "$LAUNCHER_ORIGIN" ]]; then perf_now; else printf '0'; fi)"
readarray -t PACKAGE_PLAN < <(node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const catalogue = require(process.argv[1]);
  const data = process.argv[2];
  const force = process.env.WSM_FORCE_REINSTALL === "1";
  let registry = { packages: [] };
  try { registry = JSON.parse(fs.readFileSync(path.join(data, "registry.json"), "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const semver = (value) => value.split(".").map(Number);
  const compare = (left, right) => {
    const leftVersion = semver(left.deckVersion ?? left.packageVersion);
    const rightVersion = semver(right.deckVersion ?? right.packageVersion);
    for (let index = 0; index < 3; index += 1) {
      const difference = (leftVersion[index] ?? 0) - (rightVersion[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return (left.artifactRevision ?? 1) - (right.artifactRevision ?? 1);
  };
  const resetPackages = new Set(JSON.parse(fs.readFileSync(path.join(data, "cache", "launcher-reset-packages.json"), "utf8")));
  const newestByPackage = new Map();
  for (const entry of catalogue.packages) {
    if (resetPackages.has(entry.packageId)) continue;
    const current = newestByPackage.get(entry.packageId);
    if (current === undefined || compare(entry, current) > 0) newestByPackage.set(entry.packageId, entry);
  }
  for (const entry of [...newestByPackage.values()].sort((left, right) => left.packageId.localeCompare(right.packageId))) {
    const samePackageVersion = registry.packages.filter((record) => record.packageId === entry.packageId && record.packageVersion === entry.packageVersion);
    const exactArtifact = samePackageVersion.find((record) => {
      const versionMatches = entry.deckVersion === undefined
        || ((record.deckVersion ?? record.packageVersion) === entry.deckVersion && (record.artifactRevision ?? 1) === entry.artifactRevision);
      return versionMatches
        && record.archiveSha256 === entry.package.sha256
        && fs.existsSync(path.join(data, record.installPath, "manifest.json"));
    });
    const current = !force && exactArtifact !== undefined;
    if (!current) console.log(`${entry.packageId}|${entry.packageVersion}|${samePackageVersion.length === 0 ? "install" : "force"}`);
  }
' "$FEED" "$DATA")
perf_finish "launcher.package-feed.inspect" "$INSPECTION_STARTED" "${LAUNCHER_ORIGIN:-0}"

INSTALL_STARTED="$(if [[ -n "$LAUNCHER_ORIGIN" ]]; then perf_now; else printf '0'; fi)"
if [[ ${#PACKAGE_PLAN[@]} -eq 0 ]]; then
  printf 'WhackSmacker launcher: package feed is current; no installs needed.\n' >&2
else
  printf 'WhackSmacker launcher: applying %d package install/update%s.\n' "${#PACKAGE_PLAN[@]}" "$([[ "${WSM_FORCE_REINSTALL:-0}" == "1" ]] && printf ' (forced)' || true)" >&2
fi
FAILED_PACKAGES=()
for plan in "${PACKAGE_PLAN[@]}"; do
  IFS='|' read -r pkg version mode <<<"$plan"
  printf 'WhackSmacker launcher: installing %s %s.\n' "$pkg" "$version" >&2
  install_args=(content install "$pkg" --version "$version" --catalogue "$FEED" --data-dir "$DATA")
  if [[ "$mode" == "force" ]]; then install_args+=(--force); fi
  if ! node dist/main.js "${install_args[@]}" >/dev/null; then
    FAILED_PACKAGES+=("$pkg")
    printf 'WhackSmacker launcher: %s was NOT installed; continuing with available content.\n' "$pkg" >&2
  fi
done
if (( ${#FAILED_PACKAGES[@]} )); then
  printf 'WhackSmacker launcher: %d package(s) failed installation:\n' "${#FAILED_PACKAGES[@]}" >&2
  printf '  %s\n' "${FAILED_PACKAGES[@]}" >&2
fi
perf_finish "launcher.package.install" "$INSTALL_STARTED" "${LAUNCHER_ORIGIN:-0}"

if [[ -n "$LAUNCHER_ORIGIN" ]]; then
  NODE_STARTED="$(perf_now)"
  perf_finish "launcher.node.start" "$NODE_STARTED" "$LAUNCHER_ORIGIN"
fi

exec node "$APP/dist/main.js" \
  --data-dir "$DATA" \
  --catalogue "$FEED" \
  "$@"
