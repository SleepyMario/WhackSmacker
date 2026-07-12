# Authenticated web-reader browser tests

The focused browser suite uses `@playwright/test`. It starts an ephemeral PostgreSQL 17 Docker container bound only to an automatically assigned loopback port, applies the repository migrations, creates dedicated test users, writes deterministic package fixtures beneath the operating system's temporary directory, and starts the WhackSmacker server on an automatically assigned loopback port. Global teardown stops the server and container and removes the fixtures even after a test failure. No persistent Docker volume is used.

Install the browser binaries once after installing dependencies:

```bash
npx playwright install chromium firefox
```

Docker must be available to the current user. Run the headless suite with:

```bash
npm run test:web:e2e
```

For an interactive Chromium run:

```bash
npm run test:web:e2e:headed
```

Failure-only screenshots and traces are written beneath the operating system's temporary directory, not the repository. The suite uses only temporary users, packages, credentials, ports, and database resources. It must never be configured to target a production URL or database.
