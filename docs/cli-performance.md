# CLI performance tracing

WhackSmacker includes opt-in JSON Lines performance tracing for startup and interactive terminal work:

```sh
WSM_PERF=1 \
WSM_PERF_FILE=/tmp/whacksmacker-perf.jsonl \
node dist/main.js --data-dir /path/to/content --catalogue /path/to/catalogue.json
```

Normal execution does not emit trace output. Durations use a monotonic clock. Trace metadata is limited to operational identifiers and state such as package ID, version, content path, source locale, view, toggle state, cache result, input key name, and tree node ID. Review answers, progress documents, credentials, private prose, and secrets are not recorded.

Summarize one or more traces with:

```sh
node scripts/summarize-performance-trace.mjs /tmp/whacksmacker-perf.jsonl
```

The summary reports count, total, minimum, p50, p95, maximum, counters, and nested span contributors. The realistic opt-in action harness uses a package-manager-created installation:

```sh
npm run benchmark:cli -- \
  --data-dir /tmp/wsm-profile/data \
  --catalogue /path/to/catalogue.json \
  --warmup 1 \
  --repetitions 5
```

Installed chapter text is cached for the lifetime of one Node process. The cache is bounded to 128 entries and keyed by resolved application data directory, installed-content generation, package ID and version, content path, and source locale. A successful package install, update, force reinstall, or removal advances that data directory's generation, so stale same-version content is not returned. Different data directories and locales never share an entry. Review scheduling state is not held in this immutable-content cache.

The development launcher skips TypeScript compilation when its source fingerprint matches the last successful build. It also compares each catalogue archive checksum with the installed registry and skips packages whose files and checksums are current. Use `WSM_FORCE_BUILD=1` for a forced rebuild and `WSM_FORCE_REINSTALL=1` for a forced feed reinstall. `scripts/validate-launcher-cache.sh` exercises the cold, warm, and forced paths in temporary application data.
