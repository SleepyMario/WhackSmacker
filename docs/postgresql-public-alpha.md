# PostgreSQL public-alpha mode

WhackSmacker remains filesystem-based when `DATABASE_URL` is absent. When it is present, the web server requires migrated PostgreSQL tables and uses database accounts, sessions, per-user settings, package selections, review progress, and append-only review history. It never falls back to shared filesystem user state. Shared immutable package archives and extracted content remain under the configured data directory.

## Configuration

- `DATABASE_URL`: PostgreSQL connection URI. Required for multi-user web and every `admin` command.
- `TEST_DATABASE_URL`: separate disposable database used only by integration and restore tests.
- `WHACKSMACKER_PUBLIC_URL`: externally visible origin, required before PostgreSQL mode binds publicly and used for Origin validation.
- `WHACKSMACKER_SECURE_COOKIES`: set `true` for public deployment. HTTPS public URLs also imply secure cookies.
- `WHACKSMACKER_SESSION_TTL`: bounded server-side session lifetime in seconds (default 86400).
- `WHACKSMACKER_TRUST_PROXY`: set `true` only behind a trusted proxy so forwarded client addresses may be used for throttling.

Do not set `WHACKSMACKER_WEB_PASSWORD` in production. It is a legacy fallback only when `DATABASE_URL` is absent. Protect environment and secret files with mode 0600. Database connection strings are redacted from startup errors.

## Migrations and accounts

Normal startup verifies the schema but does not migrate it. Apply and inspect deterministic, advisory-lock-protected migrations explicitly:

```sh
whacksmacker admin db status
whacksmacker admin db migrate
whacksmacker admin user create OWNER --role admin
whacksmacker admin user list
whacksmacker admin user disable USERNAME
whacksmacker admin user enable USERNAME
whacksmacker admin user reset-password USERNAME
whacksmacker admin user revoke-sessions USERNAME
```

Account creation and password reset prompt twice without echo. For controlled automation, pipe a password with `--password-stdin`; never place it in an argument. There is no public registration.

Passwords use a versioned `wsm-scrypt-v1` encoding with a unique 16-byte salt, explicit N/r/p/output-length parameters, and constant-time verification. Sessions use random opaque bearer tokens; only SHA-256 hashes are stored. The HttpOnly, SameSite=Strict session cookie contains no user data. A separate per-session CSRF token is checked together with the public Origin for browser mutations. Login throttling is bounded and keyed by normalized username plus the effective client address.

Every user-owned query takes the authenticated UUID explicitly and scopes SQL by it. Package files are a shared cache, while `user_packages` controls visibility. Review identity remains package/version/path/item; the user UUID is an ownership dimension, and every answer transaction locks the current row and appends history. PostgreSQL row-level security is a possible defense-in-depth hardening step, not enabled in this alpha.

## Known alpha limitation

The source-language selector works in the public, unauthenticated frontend. In the logged-in private app, the toggle still requires follow-up and must not be treated as fixed. Persisted per-user locale selection and source-package isolation work through the authenticated API, but users may need to refresh or use the current Settings path until the private toggle is repaired.

## Compose and backups

`compose.production.yaml` defines PostgreSQL without a host-published port, a one-shot migration service, and the application on a configurable ZeroTier or loopback bind. Copy `.env.production.example` to a protected file and create `secrets/postgres_password`. The image reference is configurable; the example does not claim that an image has already been published.

Run `scripts/postgres-backup.sh` with `DATABASE_URL` and optionally `BACKUP_DIR`. It writes an atomic, mode-0600 custom-format dump and retains seven daily and four Sunday weekly dumps. Test a dump only against a separate empty database:

```sh
DATABASE_URL='postgresql://…' BACKUP_DIR=/srv/backups ./scripts/postgres-backup.sh
TEST_DATABASE_URL='postgresql://…/whacksmacker_restore_test' ./scripts/postgres-restore-test.sh /srv/backups/daily/whacksmacker-TIMESTAMP.dump
```

Btrfs snapshots can supplement these portable dumps but do not replace them.
