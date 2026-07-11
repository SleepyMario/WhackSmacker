#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL must name a separate empty database}"
if [ "$#" -ne 1 ]; then echo "usage: $0 BACKUP.dump" >&2; exit 2; fi
if psql "$TEST_DATABASE_URL" -Atqc "SELECT 1 FROM pg_class WHERE relkind='r' AND relnamespace NOT IN (SELECT oid FROM pg_namespace WHERE nspname LIKE 'pg_%' OR nspname='information_schema') LIMIT 1" | grep -q 1; then
  echo "TEST_DATABASE_URL is not empty; refusing restore" >&2
  exit 1
fi
pg_restore --exit-on-error --no-owner --no-acl --dbname="$TEST_DATABASE_URL" "$1"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT count(*) AS users FROM users; SELECT count(*) AS migrations FROM schema_migrations;"
