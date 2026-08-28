# Animals 001–100 Technical Preview

This is a non-published technical preview for the existing WSM TSV v2, package-media, catalogue, installation, deck-family, and terminal-artwork machinery. It is not learner-ready content and it does not decide a final animal deck size or production numbering scheme.

Codex did not author, translate, correct, approve, generate, regenerate, crop, resize, convert, or otherwise change any English or Dutch language content or artwork. The generator consumes the supplied WSM source bytes through the existing external source-root mechanism. The unified archive is retained only for checksum, provenance, and byte-identity validation.

## Durable source and historical preview scope

```text
/home/ashwin/Projects/whacksmacker-modules/whacksmacker-tarballs/artifacts/animals/001-100/source/2026-08-04/2026-08-04-animals-001-100-unified-language-agnostic-v1.0.0.tar.gz
SHA-256 509897b663567c73c5257bb3f8976306d32fcbcdb82c1812d7c3244e138a6a73
```

Archive extraction is allowed only after checksum verification and rejection of absolute paths, parent traversal, symlinks, hard links, devices, unsupported member types, and duplicate normalized paths. Imported or materialized files must remain byte-identical to their archive members.

The prior Downloads and ad-hoc task directories recorded in historical reports
are non-authoritative. Current and future work follows
`/home/ashwin/Projects/whacksmacker-modules/whacksmacker-tarballs/ARCHIVE_POLICY.md`
and names durable inputs beneath that repository.

The WSM source remains draft and declares neutral placeholders for entries 66, 68, 70, 72, 75, 79, 89, and 92. Those placeholders are deliberately preserved. Draft or placeholder status is not learner approval and is not a structural error.

## Package registration

```text
targetId: dutch-general-animals-preview-001-100
packageId: com.sleepymario.language.dutch.general.animals.preview-001-100
packageVersion: 0.0.2
displayName: 1–100
contentType: topic-review
capabilities: topic-review
deckFamily: general
topic.id: animals
topic.displayName: Animals
topic.deckDisplayName: 1–100
relatedPackageIds: com.sleepymario.language.dutch
languages: en, nl
```

The preview-only package ID, explicit-only target flag, `technical-preview` subject metadata, technical-preview description, and absence of any feed registration keep the non-published status unambiguous. Version `0.0.2` adds explicit generic topic/category and deck labels while retaining `0.0.0` and `0.0.1` as inactive local rollback versions. The target is excluded from an untargeted generator run. It must be requested explicitly and supplied with the external source root.

The generator snapshots the exact supplied `README.md` and `cards.tsv`, converts the exact 200 card rows into the existing memorization-item v2 JSON representation, and includes only raster files referenced by those cards. Image bytes are never transformed. Card IDs remain the supplied IDs; package ID, package version, stable card ID, and pedagogical fingerprint retain their existing progress roles.

## Isolated generation and installation

Historical preview outputs were disposable and are not authoritative handoffs.
For a new rehearsal, use a fresh directory beneath the durable repository's
task-specific `.work` directory, the exact fixed timestamp, and the existing
CLI tools. Never point `--data-dir` at the normal user data directory.

```sh
cd /home/ashwin/Projects/whacksmacker-modules/whacksmacker
npm run build

WSM_PREVIEW_ROOT="/home/ashwin/Projects/whacksmacker-modules/whacksmacker-tarballs/.work/<dated-task>/animals-preview"
mkdir -p "$WSM_PREVIEW_ROOT/source" "$WSM_PREVIEW_ROOT/packages" "$WSM_PREVIEW_ROOT/data"
node scripts/validate-animals-preview-inputs.mjs --output "$WSM_PREVIEW_ROOT/source"

WHACKSMACKER_PACKAGE_SOURCE_ROOT="$WSM_PREVIEW_ROOT/source" \
  node dist/packages/core/content-package-generator-cli.js \
  --target dutch-general-animals-preview-001-100 \
  --generated-at 2026-08-05T00:00:00Z \
  --output-dir "$WSM_PREVIEW_ROOT/packages"

node dist/packages/core/content-package-generator-cli.js \
  --target dutch-curriculum \
  --generated-at 2026-08-05T00:00:00Z \
  --output-dir "$WSM_PREVIEW_ROOT/packages"

node dist/packages/core/content-package-catalogue-cli.js \
  --packages-dir "$WSM_PREVIEW_ROOT/packages" \
  --output "$WSM_PREVIEW_ROOT/catalogue.json" \
  --generated-at 2026-08-05T00:00:00Z

node dist/main.js content install com.sleepymario.language.dutch \
  --catalogue "$WSM_PREVIEW_ROOT/catalogue.json" --data-dir "$WSM_PREVIEW_ROOT/data"
node dist/main.js content install com.sleepymario.language.dutch.general.animals.preview-001-100 \
  --catalogue "$WSM_PREVIEW_ROOT/catalogue.json" --data-dir "$WSM_PREVIEW_ROOT/data"
```

The interactive hierarchy is `Dutch` → `General Decks` → `Animals` → `1–100`. `Animals` is the stable reusable topic category and `1–100` is the directly launchable Review leaf; there is no intermediate `Review deck` child. The preview must not appear under Reading Decks, Specialized Decks, the legacy Specialized branch, Traditional Chinese, or another language. Its technical-preview status remains internal and documented rather than appearing in the learner title.

## Optional Alacritty + sway artwork smoke

Automated validation uses a fake controller and emits no live terminal control sequences. The following optional human smoke uses only the task-owned installation prepared above (or the exact validated task path) and must be run in Alacritty under sway with Überzug++ available:

```sh
cd /home/ashwin/Projects/whacksmacker-modules/whacksmacker
WSM_PREVIEW_DATA=/home/ashwin/Projects/whacksmacker-modules/whacksmacker-tarballs/.work/<dated-task>/animals-preview/data
node dist/main.js --data-dir "$WSM_PREVIEW_DATA" artwork backend auto
node dist/main.js --data-dir "$WSM_PREVIEW_DATA" artwork diagnostics
node dist/main.js --data-dir "$WSM_PREVIEW_DATA"
```

Open `Installed modules` → `Languages` → `Dutch` → `General Decks` → `Animals` → `1–100`. Confirm that Enter starts Review directly with header `Review: Animals / 1–100`, artwork is reserved above `Phrase:`, both learner lines are vertical yellow bullets, reveal replaces the artwork in the same region, large high-confidence pale mattes are conservatively removed at display time, and resize performs one contained redraw. Then press Escape to leave Review and `q` to exit.

After exit, verify helper cleanup without killing unrelated processes:

```sh
pgrep -af 'ueberzugpp layer'
```

No matching Review helper should remain.

## Future approved source

A future human-approved source can replace this preview by registering a production package identity/version against the same `topic-review` target shape, WSM TSV v2 parser, package-media collector, catalogue propagation, installer, menu family, and artwork controller. Approval may change content bytes or deck boundaries only in that separately authorized source process; it does not require a new package framework or changes to the technical machinery validated here.
