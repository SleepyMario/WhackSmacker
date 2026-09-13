# Daily Docker validation

The daily job builds isolated, clean clones of committed HEADs. Uncommitted
curriculum work is neither reset nor exported. The image includes Japanese,
Korean and Vietnamese reading assets plus any currently authored core Review
packages; a cast-only/empty review tree does not manufacture an empty package.
Present-but-invalid cards still fail production package generation.

`npm run test:docker` builds the application and runs the explicit application
release suite in `scripts/test-docker.mjs`. It includes package archive/path/hash
safety, installation/update/progress preservation, scheduling, CLI, web/database,
media and deployment tests. Package-manager fixtures are synthetic and independent
of external curriculum authoring. Docker construction then validates each bundled
Review package and the workflow runs the real image entrypoint with fresh data.
Every stage must pass before publishing; there is no ignore-failure switch.

`npm test` remains the combined application and curriculum-authoring audit suite.
It contains historical assertions for retired Dutch I–LXXXV, Korean XI–XV and
Vietnamese VI–XXX material, and historical menu/content assumptions. These are
not the application release contract and are not silently reported as passing.
They still need migration if the combined authoring audit is used. The Japanese
installed contextual-reading content check remains separately available in
`test/japanese-installed-contextual-reading.test.mjs`.

Validation-only mode builds and smoke-tests but does not push. Production verifies
source labels and the pushed registry digest. A VM started for the job is shut
down gracefully; already-running guests are left to their owner.
