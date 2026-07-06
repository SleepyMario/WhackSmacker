# Remaining Bundled Content Audit

Date: 2026-07-06

The installed content package flow has been validated end to end for:

- `com.sleepymario.language.korean`
- `com.sleepymario.language.linguistic-terminology`

That validated flow covers source repositories, generated `.wspkg` packages, generated local catalogue, temporary installation, installed Korean reading, installed Linguistic Terminology reading, progress separation, and package removal behavior.

This audit is narrower: it maps the remaining bundled, static, compatibility, and old-assumption paths that still exist after that validation. It does not delete files, remove snapshots, change runtime behavior, or change Anki behavior.

## Inventory

| Category | Path | Kind | Current purpose | Surface | Required today? | Blocks package-only operation? | Recommended future action |
|---|---|---|---|---|---|---|---|
| Bundled linguistic terminology snapshot | `packages/language/linguistic-terminology-snapshot.ts` | Generated checked-in TypeScript data | Provides the searchable bundled terminology glossary used by `language terminology` | Runtime behavior, bundled fallback/static content | Yes, while `language terminology` remains supported and package install UX is still maturing | No for installed package flow; yes for strict package-only language terminology if the bundled command is considered in scope | Keep for now. Later deprecate after installed terminology package UX is the documented primary path and search/navigation exists for installed packages. |
| Bundled terminology runtime reader | `packages/language/linguistic-terminology.ts` | Runtime code | Imports the bundled snapshot for `getLinguisticTerminologySnapshot`, search, category filtering, stable-ID lookup, related-link resolution, and `language terminology`; also implements installed-package browsing for `language terms` | Runtime behavior and compatibility path | Yes | No for `language terms`; yes if removing bundled `language terminology` | Split or deprecate the bundled snapshot-facing command only after installed package search covers the same use cases. |
| Bundled terminology CLI route | `packages/language/index.ts` | CLI registration | Registers `language terminology` as "Browse the bundled linguistic terminology glossary" and `language terms` as installed-package browsing | Runtime behavior and compatibility route | Yes, because README and tests document both commands | No for installed packages; yes for strict package-only CLI cleanup | Eventually mark `language terminology` as fallback/deprecated, then remove in a separate task after migration. |
| Interactive Language menu compatibility | `apps/cli/interactive-menu.ts` | Menu wiring | Exposes installed Korean and installed Linguistic Terms surfaces. The Linguistic Terms submenu routes through installed package groups, not the bundled search command. | Runtime behavior | Yes | No | Keep. Later ensure menu copy makes installed packages the primary path and does not imply bundled terminology is canonical. |
| Native Korean missing-package fallback | `packages/language/korean.ts` | Missing-package message | Reports that `com.sleepymario.language.korean` is not installed and prints install guidance. It does not fall back to bundled Korean content. | Runtime behavior, fallback UX | Yes | No | Keep. Improve install guidance and catalogue discovery later. |
| Native Linguistic Terms missing-package fallback | `packages/language/linguistic-terminology.ts` | Missing-package message | Reports that `com.sleepymario.language.linguistic-terminology` is not installed and prints install guidance for `language terms`. | Runtime behavior, fallback UX | Yes | No | Keep. Make catalogue/install guidance clearer before removing bundled terminology search. |
| Source snapshot package format | `packages/core/content-package-generator.ts` | Generated content schema | Builds current Korean and Linguistic Terminology packages as `whacksmacker-source-markdown-snapshot-v1` in `content/content.json` | Package generation, generated snapshot format | Yes | No | Keep until subject-specific schemas and review-item generation are designed. |
| Source snapshot reader | `packages/core/content-package-reader.ts` | Installed package reader | Detects `content/content.json` source snapshots and exposes Markdown/plain text/JSON entries as readable installed content | Runtime behavior for installed packages | Yes | No | Keep. Later retain as a compatibility reader or migrate packages to richer content schemas. |
| Linguistic terminology sync script | `scripts/sync-linguistic-terminology.mjs` | Snapshot generation script | Regenerates `packages/language/linguistic-terminology-snapshot.ts` from a local terminology repo | Development compatibility tool | Yes, while the bundled snapshot remains | No for installed package runtime | Update the default source path later. It still defaults to `../languages/linguistic-terminology`, which is stale under the current module layout; use `--source` or `LINGUISTIC_TERMINOLOGY_SOURCE` until fixed. |
| Terminology snapshot documentation | `docs/linguistic-terminology.md` | Documentation | Describes the standalone terminology repo and checked-in bundled snapshot workflow | Documentation | Yes, as historical/current fallback docs | No | Later rewrite to make installed package terminology primary and bundled snapshot explicitly fallback/deprecated. |
| README bundled terminology references | `README.md` | Documentation | Documents both `language terms` for installed package content and `language terminology` for bundled searchable snapshot | Documentation | Yes, because both commands exist | No | Later make installed packages the primary path and move bundled snapshot to a fallback/deprecation section. |
| Anki parity documentation | `docs/anki-parity.md` | Historical documentation | Records native parity coverage and explicitly states the old Anki-backed command was removed | Documentation | Yes, for roadmap history | No | Keep until native review docs fully replace historical migration context. Then archive or shorten. |
| Anki references in roadmap docs | `docs/content-packages/roadmap.md`, `docs/content-packages/README.md`, `docs/reading-to-review.md`, `docs/review-scheduler.md`, `docs/exercise-renderers.md`, `docs/content-packages/memorization-items.md`, `docs/content-packages/package-management.md` | Historical roadmap documentation | Describe which roadmap points did or did not include Anki migration/removal and that Anki paths are now removed | Documentation | Mostly yes for milestone history | No | Later separate historical roadmap notes from current user-facing docs. |
| Mathematics AnkiConnect negative reference | `docs/mathematics-curriculum.md` | Documentation | States mathematics generation does not contact AnkiConnect | Documentation | Useful as a negative runtime guarantee | No | Keep unless the docs are consolidated. |
| Generated package examples | `docs/content-packages/examples/*.json` | Documentation examples | Example manifests and catalogue entries for package format/catalogue validation | Documentation and test fixtures | Yes | No | Keep. They are examples, not runtime bundled content. |
| Local generated artifact ignore policy | `.gitignore`, `docs/mathematics-artifacts.md` | Artifact policy | Keeps `.tgz`, `dist/`, `packages-output/`, `math-artifacts/`, and default generated workbook PDFs out of Git | Generated artifact guard | Yes | No | Keep. Extend later if new generated package outputs are introduced. |
| Installed-content e2e audit | `docs/content-packages/installed-content-e2e.md` | Audit documentation | Records `/tmp` package/catalogue/install validation and notes bundled terminology search still exists | Documentation | Yes | No | Keep as validation history. Refresh when release checklist exists. |
| Root post-roadmap pointer | `docs/post-roadmap-audit.md` | Compatibility documentation pointer | Redirects old audit location to `docs/content-packages/post-roadmap-audit.md` | Documentation compatibility path | Yes, harmless | No | Keep until old doc links are no longer used. |
| Snapshot tests | `test/linguistic-terminology.test.mjs`, `test/cli.test.mjs` | Tests | Assert bundled terminology snapshot loads, has stable IDs, searches `semivowel` and `받침`, and renders through `language terminology` | Tests preserving bundled behavior | Yes, while bundled command remains | No for installed package flow | Update only when the bundled command is deprecated or removed. |
| Installed package language tests | `test/language-korean.test.mjs`, `test/language-terms.test.mjs` | Tests | Assert missing-package messaging and installed package browsing for Korean and Linguistic Terminology | Tests preserving package behavior and fallback UX | Yes | No | Keep. Extend later for clearer install guidance or release checklist coverage. |
| Removed Anki route tests | `test/architecture.test.mjs`, `test/cli.test.mjs` | Tests | Assert `status`, `decks`, `review <deck>` and old language deck aliases no longer resolve while native review commands do | Tests preserving removed legacy behavior | Yes | No | Keep to prevent regression. |
| Source snapshot reader tests | `test/content-package-reader.test.mjs`, `test/reading-review-integration.test.mjs` | Tests | Assert source snapshot packages are readable and review integration can coexist with snapshot content | Tests preserving current package format behavior | Yes | No | Keep until source snapshots are replaced or versioned as a legacy package format. |
| Package generator/catalogue/install tests | `test/content-package-generator.test.mjs`, `test/content-package-catalogue.test.mjs`, `test/content-package-manager.test.mjs` | Tests | Generate temporary `.wspkg` files and catalogues under test temp directories | Test fixtures and generated artifacts | Yes | No | Keep. Ensure they continue writing only to temp directories. |

## Old Path Assumptions

No active runtime code was found that reads from `/home/ashwin/Projects/languages`.

One development script still contains a stale relative default:

```text
scripts/sync-linguistic-terminology.mjs -> ../languages/linguistic-terminology
```

Under the current module layout, the intended source repository is:

```text
/home/ashwin/Projects/whacksmacker-modules/linguistic-terminology
```

The script can be pointed at the correct source with `--source` or `LINGUISTIC_TERMINOLOGY_SOURCE`. Its default should be fixed in a separate task because this audit is intentionally documentation-only.

Docs now mostly state the current module root. Remaining mentions of `/home/ashwin/Projects/languages` are warnings not to assume that old path.

## Keep For Now

- Keep `packages/language/linguistic-terminology-snapshot.ts` while `language terminology` remains the searchable offline glossary.
- Keep the bundled terminology tests while the bundled command remains supported.
- Keep Korean and Linguistic Terms missing-package messages; they are the current package-install guidance path.
- Keep removed-Anki route tests; they prevent accidental restoration of old Anki command shapes.
- Keep source snapshot package generation and reading support; current validated packages depend on it.
- Keep generated package examples and `.gitignore` artifact exclusions.
- Keep historical Anki parity docs until the native review system has a complete current-state release guide.

## Candidate Removals Later

Only remove these after an explicit cleanup task:

- bundled terminology snapshot data;
- `language terminology` bundled search command;
- snapshot synchronization workflow if installed package search fully replaces it;
- docs that present bundled terminology as the default path;
- stale sync-script default path;
- historical Anki references that are no longer useful once native review docs are complete;
- source snapshot package support, but only after packages are migrated to a replacement schema;
- empty or stale generated artifact references if future package output policy changes.

## Risks

- Removing the bundled terminology snapshot too early would break offline `language terminology` search before installed terminology search has equivalent UX.
- Removing compatibility tests before behavior changes would make it easier to accidentally restore old Anki commands or break missing-package guidance.
- Treating generated package content as user state could risk deleting progress during package removal. Current package and progress separation must stay explicit.
- Removing source snapshot reader support would break currently generated Korean and Linguistic Terminology packages.
- Changing the sync script default without validating the terminology repository layout could silently regenerate a different bundled snapshot.
- Making package-only behavior the default before catalogue/install UX is comfortable could make the Language menu feel empty on fresh installs.

## Recommended Next Cleanup Order

1. Keep bundled terminology only as an explicit fallback while installed package search/navigation improves.
2. Add clearer CLI messages for missing packages, including catalogue location guidance.
3. Fix the stale `scripts/sync-linguistic-terminology.mjs` default source path.
4. Deprecate stale bundled snapshot paths after installed package UX covers search, IDs, categories, and related links.
5. Remove the bundled terminology snapshot only after package install UX is good and a release checklist verifies installed terminology.
6. Shorten or archive remaining Anki docs/references only after native review is fully documented.
7. Add a release checklist for post-Anki package-based WhackSmacker.
