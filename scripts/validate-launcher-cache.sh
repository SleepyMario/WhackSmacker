#!/usr/bin/env bash
set -euo pipefail

LAUNCHER="${WSM_LAUNCHER:-/home/ashwin/bin/wsm-run.sh}"
ROOT="$(mktemp -d /tmp/wsm-launcher-cache-validation.XXXXXX)"
trap 'rm -rf -- "$ROOT"' EXIT

XDG_DATA_HOME="$ROOT" "$LAUNCHER" --help >/dev/null 2>"$ROOT/first.stderr"
XDG_DATA_HOME="$ROOT" "$LAUNCHER" --help >/dev/null 2>"$ROOT/warm.stderr"
grep -F 'build is current' "$ROOT/warm.stderr" >/dev/null
grep -F 'package feed is current; no installs needed' "$ROOT/warm.stderr" >/dev/null

WSM_FORCE_BUILD=1 XDG_DATA_HOME="$ROOT" "$LAUNCHER" --help >/dev/null 2>"$ROOT/force-build.stderr"
grep -F 'rebuilding application (forced)' "$ROOT/force-build.stderr" >/dev/null

WSM_FORCE_REINSTALL=1 XDG_DATA_HOME="$ROOT" "$LAUNCHER" --help >/dev/null 2>"$ROOT/force-install.stderr"
grep -F 'package install/update (forced)' "$ROOT/force-install.stderr" >/dev/null

printf 'Launcher cache validation passed.\n'
