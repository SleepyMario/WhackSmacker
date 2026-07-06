# Installed Content Package E2E Audit

Date: 2026-07-06

This audit validates the implemented local installed-content flow for the first two WhackSmacker content packages. It does not add features, remove bundled snapshots, change Anki behavior, or modify external curriculum repositories.

## Scope

Repository validated:

```text
/home/ashwin/Projects/whacksmacker-modules/whacksmacker
```

Read-only package-generation inputs:

```text
/home/ashwin/Projects/whacksmacker-modules/korean-curriculum
/home/ashwin/Projects/whacksmacker-modules/linguistic-terminology
```

Temporary paths used:

```text
/tmp/whacksmacker-e2e-packages
/tmp/whacksmacker-e2e-catalogue/catalogue.json
/tmp/whacksmacker-e2e-data
/tmp/whacksmacker-e2e-progress
```

The temporary directories were cleaned before validation.

## Commands Used

Initial inspection:

```sh
git status
git log --oneline -20
cat package.json
```

Package generation:

```sh
npm run generate-content-package -- \
  --target linguistic-terminology \
  --target korean-curriculum \
  --output-dir /tmp/whacksmacker-e2e-packages \
  --generated-at 2026-07-06T00:00:00Z
```

Catalogue generation:

```sh
npm run content:catalogue -- \
  --packages-dir /tmp/whacksmacker-e2e-packages \
  --output /tmp/whacksmacker-e2e-catalogue/catalogue.json \
  --generated-at 2026-07-06T00:00:00Z \
  --catalogue-id com.sleepymario.local.e2e \
  --display-name "WhackSmacker E2E Catalogue" \
  --description "Temporary installed content flow validation catalogue"
```

Available package listing:

```sh
node dist/main.js content available --catalogue /tmp/whacksmacker-e2e-catalogue/catalogue.json
```

Package installation:

```sh
node dist/main.js content install com.sleepymario.language.korean \
  --catalogue /tmp/whacksmacker-e2e-catalogue/catalogue.json \
  --data-dir /tmp/whacksmacker-e2e-data

node dist/main.js content install com.sleepymario.language.linguistic-terminology \
  --catalogue /tmp/whacksmacker-e2e-catalogue/catalogue.json \
  --data-dir /tmp/whacksmacker-e2e-data
```

Installed package listing:

```sh
node dist/main.js content installed --data-dir /tmp/whacksmacker-e2e-data
```

Korean installed-content checks:

```sh
node dist/main.js language korean --data-dir /tmp/whacksmacker-e2e-data

node dist/main.js content read com.sleepymario.language.korean \
  --data-dir /tmp/whacksmacker-e2e-data \
  --file units/hangul-foundation/README.md

node dist/main.js language korean \
  --data-dir /tmp/whacksmacker-e2e-data \
  --file units/hangul-foundation/README.md
```

Linguistic Terminology installed-content checks:

```sh
node dist/main.js language terms --data-dir /tmp/whacksmacker-e2e-data

node dist/main.js language terms korean --data-dir /tmp/whacksmacker-e2e-data

node dist/main.js language terms \
  --data-dir /tmp/whacksmacker-e2e-data \
  --file terms/korean.md

node dist/main.js language terms \
  --data-dir /tmp/whacksmacker-e2e-data \
  --file terms/phonetics-and-phonology.md
```

Progress separation checks:

```sh
node -e "const {saveReviewProgressStore}=require('./dist/packages/core/review-progress-store.js'); const {emptyReviewProgressStore}=require('./dist/packages/core/review-scheduler.js'); saveReviewProgressStore(emptyReviewProgressStore('2026-07-06T00:00:00Z'), '/tmp/whacksmacker-e2e-progress').then((p)=>console.log(p));"

find /tmp/whacksmacker-e2e-data/packages -type f -printf '%P %s\n' | sort > /tmp/whacksmacker-e2e-before-files.txt

node dist/main.js content read com.sleepymario.language.korean \
  --data-dir /tmp/whacksmacker-e2e-data \
  --file units/hangul-foundation/README.md

node dist/main.js content read com.sleepymario.language.linguistic-terminology \
  --data-dir /tmp/whacksmacker-e2e-data \
  --file terms/korean.md

node dist/main.js review due \
  --data-dir /tmp/whacksmacker-e2e-data \
  --now 2026-07-06T00:00:00Z

find /tmp/whacksmacker-e2e-data/packages -type f -printf '%P %s\n' | sort > /tmp/whacksmacker-e2e-after-files.txt

diff -u /tmp/whacksmacker-e2e-before-files.txt /tmp/whacksmacker-e2e-after-files.txt
```

Remove-package smoke check:

```sh
node dist/main.js content remove com.sleepymario.language.linguistic-terminology \
  --version 0.1.0 \
  --data-dir /tmp/whacksmacker-e2e-data

node dist/main.js content installed --data-dir /tmp/whacksmacker-e2e-data
```

## Results

Generated packages:

```text
/tmp/whacksmacker-e2e-packages/com.sleepymario.language.linguistic-terminology-0.1.0.wspkg
/tmp/whacksmacker-e2e-packages/com.sleepymario.language.korean-0.1.0.wspkg
```

The generated manifests validated during generation and install. They recorded these source commits:

| Package | Source commit |
|---|---|
| `com.sleepymario.language.korean` | `0cd32bb952678a3544a03d6e93055ffa954dfa56` |
| `com.sleepymario.language.linguistic-terminology` | `ebec8c56282167c9d6d025279bae4ad296e9f73b` |

The generator used sibling source repositories under `/home/ashwin/Projects/whacksmacker-modules`. No `.wspkg` files were written into the WhackSmacker Git repository.

Generated catalogue:

```text
/tmp/whacksmacker-e2e-catalogue/catalogue.json
```

The catalogue validated and contained both expected package IDs. Package URLs were `file://` URLs, with real archive sizes and SHA-256 checksums:

| Package | Size | SHA-256 |
|---|---:|---|
| `com.sleepymario.language.korean` | `309373` | `ae7d6f463421b1bef775bc4f90cc4e6c2d2ff811798907c7dfa5c9c130eee874` |
| `com.sleepymario.language.linguistic-terminology` | `67302` | `1876bb77cdada464b89cd13f2c6bd33f96763cf25eda423e3305665679107a14` |

No generated catalogue was written into the WhackSmacker Git repository.

Available package listing included:

```text
com.sleepymario.language.korean 0.1.0 Korean Curriculum
com.sleepymario.language.linguistic-terminology 0.1.0 Linguistic Terminology
```

Installed packages were placed under:

```text
/tmp/whacksmacker-e2e-data/packages/com.sleepymario.language.korean/0.1.0
/tmp/whacksmacker-e2e-data/packages/com.sleepymario.language.linguistic-terminology/0.1.0
```

Both installed package directories contained `manifest.json` and `content/content.json`. The installed-package registry was created at:

```text
/tmp/whacksmacker-e2e-data/registry.json
```

The registry recorded package source metadata, manifest checksums, archive checksums, archive sizes, install paths, and catalogue ID. The install flow therefore verified archive checksum, archive size, manifest validity, manifest identity against the catalogue, and declared file integrity.

The installed content commands did not require source repositories at runtime. The source repositories were used to generate `.wspkg` archives; reading and language browsing used `/tmp/whacksmacker-e2e-data`.

## Korean Content Check

`language korean --data-dir /tmp/whacksmacker-e2e-data` reported:

```text
Status: installed
Version: 0.1.0
Title: Korean Curriculum
```

It listed Hangul Foundation entries, including:

```text
units/hangul-foundation/README.md
units/hangul-foundation/chapter-01-vowels/README.md
units/hangul-foundation/chapter-04-basic-batchim/README.md
```

Opening `units/hangul-foundation/README.md` through both `content read` and `language korean --file` rendered the installed Markdown. The missing-package message was not shown.

## Linguistic Terminology Content Check

`language terms --data-dir /tmp/whacksmacker-e2e-data` reported:

```text
Status: installed
Version: 0.1.0
Title: Linguistic Terminology
```

It exposed readable groups:

```text
General
Korean
```

Opening `terms/korean.md` through `language terms --file` rendered installed glossary content containing `받침`. Opening `terms/phonetics-and-phonology.md` rendered installed glossary content containing `semivowel`.

The direct `language terminology --search semivowel` command still searches the bundled static terminology snapshot. Installed-package browsing for generated terminology content is currently exposed through `language terms` and `content read`.

## Progress Separation

No progress, review, or settings files were found under:

```text
/tmp/whacksmacker-e2e-data/packages
```

A valid review progress store was written separately at:

```text
/tmp/whacksmacker-e2e-progress/review-progress.json
```

Reading installed Korean and Linguistic Terminology content did not change the package-directory file list. Running `review due --data-dir /tmp/whacksmacker-e2e-data` reported no native review items due because the generated source-snapshot packages do not contain memorization item files. It also did not write progress into package directories.

## Remove-Package Smoke Check

Removing `com.sleepymario.language.linguistic-terminology` version `0.1.0` succeeded.

After removal:

- `content installed --data-dir /tmp/whacksmacker-e2e-data` listed only `com.sleepymario.language.korean 0.1.0`;
- the Linguistic Terminology version directory was removed;
- the Korean package remained installed;
- `/tmp/whacksmacker-e2e-progress/review-progress.json` remained untouched.

An empty parent directory for `com.sleepymario.language.linguistic-terminology` remained under `packages/`. That is harmless but could be cleaned up in a future polish pass.

## Limitations and Follow-Up

- The flow is terminal-only.
- Generated Korean and Linguistic Terminology packages are source Markdown snapshots; they do not create review items unless package-authored memorization files are added.
- `language terminology --search` uses the bundled static terminology snapshot, while installed generated terminology content is exposed through `language terms` and `content read`.
- Catalogue IDs must use valid lowercase reverse-domain syntax; `local.e2e` failed validation and `com.sleepymario.local.e2e` was used.
- The remove path deletes the selected version but currently leaves an empty package-ID parent directory.
- Keep bundled snapshots until installed-package replacements are proven safe for normal use.
