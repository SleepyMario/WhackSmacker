# Local installation and recovery layout

Run `bash scripts/run-local.sh`; the personal `~/bin/wsm-run.sh` delegates here.
The default source feed is the sibling whacksmacker-packages/catalogue.json;
WSM_CATALOGUE can override it. XDG_DATA_HOME controls application data.

The source catalogue and historical archives are retained. The derived feed
under whacksmacker/cache excludes superseded legacy Japanese, Korean and
Vietnamese reading/review artifacts. These six replacements were verified
against source during the October 23 recovery; do not generalize that rule to
other package identities without checking their content.

Reset curricula remain visible as grey reminders and are skipped by automatic
installation. The generated launcher-reset-packages.json sidecar records them.
The canonical source repositories remain authoritative; no lessons are generated.

Language progress lives beside the application data directory in
../progress/review-progress.json. Wandering the World progress lives inside
whacksmacker/progress/wandering-the-world/review-progress.json. Do not merge,
reset or relocate these stores as a housekeeping operation.

The installed registry and package directories remain intact. Historical
archives, private decks and unrelated uncommitted source changes are retained.
Recovery evidence and previous launcher copies are in the infrastructure task's
work/wsm-recovery-audit directory. The current launcher still automatically
installs pending packages on startup, including when passed --help.
