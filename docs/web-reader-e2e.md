# Authenticated Web Reader and Review browser tests

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

The same isolated harness covers the preferred Review surface: exact physical Review-package authorization, stable progress identities, ordinary/specialized separation, source discovery, hidden-answer/reveal/grade sequencing, duplicate-submit suppression, per-user and per-version persistence, CSRF failures, inert untrusted card text, focus visibility, and responsive overflow. Visual evidence captures Review selection, hidden/revealed cards, rating focus states, completion, no-due, empty, error, expired-session, theme, and supported UI-locale states at the preserved viewport classes.

The production-package regression test installs the active-feed Vietnamese reading and core Review archives into a new operating-system temporary directory. It verifies catalogue/archive identities, the numeric Chapter 1–30 inventory, Chapters 1, 10, 11, and 30 in all three Web reader modes with Translation and Breakdown, and both directions of the real `tôi` Review card. It never reads from or writes to the normal user data directory.

The light theme overrides only the sidebar token family. Its neutral charcoal values are `#3f464d` background, `#59636d` border, `#f2f4f6` text, `#d1d6db` muted/footer text, `#d6b4ff` icon, `#77818b`/`#49515a` hover, `#c98cff` active border, `#515a63`→`#474f57` active gradient, and `#454d55`/`#707a84` footer background/border. The corresponding dark-theme tokens retain their pre-repair values exactly. Static contrast checks and browser focus/overflow tests protect both themes.
