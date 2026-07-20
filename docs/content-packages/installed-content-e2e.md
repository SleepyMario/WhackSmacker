# Installed Content Package E2E Procedure

This procedure validates the installed-content architecture without depending on a curriculum that is no longer distributed.

## Scope

Run the package generator for the retained Dutch and Vietnamese curriculum targets and Linguistic Terminology, create a temporary catalogue, install the packages into a temporary data directory, and exercise reading and review discovery. The procedure must not write progress into package directories.

## Checks

1. Generate each configured target into a new temporary package directory.
2. Build and validate a local catalogue from those archives.
3. Install the packages into a new temporary data directory.
4. Confirm `content installed` lists the installed package IDs and versions.
5. Confirm installed Dutch and Vietnamese reading entries can be listed and opened.
6. Confirm Linguistic Terminology entries can be listed and opened.
7. Confirm package-authored review sources can be listed and synced into the separate progress store.
8. Confirm reading does not alter package-directory files.
9. Remove one package and confirm its other installed packages and progress data remain intact.

## Required separation

Generated archives, extracted package content, the installed-package registry, and review progress are separate concerns. Installed package content is immutable. Scheduler and progress data remain under the user data directory, outside package-version directories.

## Limitations

Source Markdown snapshots do not create review items unless package-authored memorization files are included. The installed reader and review commands remain terminal-oriented.
