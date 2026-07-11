#!/bin/sh
set -eu
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
backup_dir=${BACKUP_DIR:-./backups}
mkdir -p "$backup_dir/daily" "$backup_dir/weekly"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary="$backup_dir/.whacksmacker-$stamp.dump.tmp"
daily="$backup_dir/daily/whacksmacker-$stamp.dump"
trap 'rm -f "$temporary"' EXIT HUP INT TERM
pg_dump --format=custom --no-owner --no-acl --file="$temporary" "$DATABASE_URL"
chmod 600 "$temporary"
mv "$temporary" "$daily"
if [ "$(date -u +%u)" = 7 ]; then cp -p "$daily" "$backup_dir/weekly/whacksmacker-$stamp.dump"; fi
find "$backup_dir/daily" -type f -name 'whacksmacker-*.dump' -printf '%T@ %p\n' | sort -nr | sed -n '8,$p' | cut -d' ' -f2- | xargs -r rm -f
find "$backup_dir/weekly" -type f -name 'whacksmacker-*.dump' -printf '%T@ %p\n' | sort -nr | sed -n '5,$p' | cut -d' ' -f2- | xargs -r rm -f
printf '%s\n' "$daily"
