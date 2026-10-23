import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const canonicalRepository = "docker.io/sleepiestmario/whacksmacker";
const activeFiles = [
  "compose.production.yaml",
  "compose.split.production.yaml",
  "compose.split.local.yaml",
  ".env.production.example",
  "scripts/operations/whacksmacker-docker-daily.sh",
  "scripts/operations/whacksmacker-docker-release.sh",
  "scripts/operations/whacksmacker-docker-vm-daily.sh",
  "README.md",
  "docs/postgresql-public-alpha.md"
];

test("active Docker workflow references only the canonical Docker Hub repository", async () => {
  const contents = await Promise.all(activeFiles.map(async path => [path, await readFile(path, "utf8")]));
  for (const [path, content] of contents) {
    assert.doesNotMatch(content, /ghcr\.io\/(?:sleepy|sleepiest)mario\/whacksmacker/i, path);
    assert.doesNotMatch(content, /(?:docker\.io\/)?sleepymario\/whacksmacker/i, path);
  }
  assert.ok(contents.some(([, content]) => content.includes(canonicalRepository)));
});

test("latest is isolated to the automated daily snapshot lane", async () => {
  const daily = await readFile("scripts/operations/whacksmacker-docker-daily.sh", "utf8");
  const release = await readFile("scripts/operations/whacksmacker-docker-release.sh", "utf8");
  const production = await readFile("compose.production.yaml", "utf8");
  const splitProduction = await readFile("compose.split.production.yaml", "utf8");
  assert.match(daily, /docker\.io\/sleepiestmario\/whacksmacker:latest/);
  assert.doesNotMatch(production, /whacksmacker:latest/);
  assert.doesNotMatch(splitProduction, /whacksmacker:latest/);
  assert.match(release, /release tag must be an explicit semantic version/);
  assert.match(release, /manual releases may not use latest/);
});

test("Docker workflows enforce source provenance, clean state, and remote digest checks", async () => {
  const daily = await readFile("scripts/operations/whacksmacker-docker-daily.sh", "utf8");
  const release = await readFile("scripts/operations/whacksmacker-docker-release.sh", "utf8");
  const orchestrator = await readFile("scripts/operations/whacksmacker-docker-vm-daily.sh", "utf8");
  for (const script of [daily, release]) {
    assert.match(script, /org\.opencontainers\.image\.revision/);
    assert.match(script, /remote_digest/);
    assert.match(script, /npm ci/);
    assert.match(script, /npm audit --audit-level=high/);
    assert.match(script, /org\.whacksmacker\.content\.dutch\.revision/);
    assert.match(script, /org\.whacksmacker\.content\.vietnamese\.revision/);
    assert.match(script, /--file "\$build_context\/whacksmacker\/Dockerfile"/);
  }
  assert.match(daily, /source checkout is dirty/);
  assert.match(release, /manual releases require a clean source checkout/);
  for (const repository of [
    "whacksmacker",
    "language-learning-curriculum-builder",
    "linguistic-terminology",
    "language-curriculum-specialized",
    "arabic-curriculum",
    "chinese-curriculum",
    "dutch-curriculum",
    "english-curriculum",
    "french-curriculum",
    "german-curriculum",
    "hindi-curriculum",
    "japanese-curriculum",
    "korean-curriculum",
    "russian-curriculum",
    "spanish-curriculum",
    "thai-curriculum",
    "vietnamese-curriculum",
    "zulu-curriculum"
  ]) assert.match(orchestrator, new RegExp(`^  ${repository}$`, "m"));
  assert.doesNotMatch(orchestrator, /whacksmacker-packages/);
  assert.doesNotMatch(orchestrator, /whacksmacker-site/);
  assert.doesNotMatch(orchestrator, /math-curriculum/);
});

test("Docker context excludes local state and uses a production-validated feed", async () => {
  const dockerfile = await readFile("Dockerfile", "utf8");
  const ignore = await readFile("Dockerfile.dockerignore", "utf8");
  const prepare = await readFile("scripts/prepare-docker-context.sh", "utf8");
  assert.match(dockerfile, /COPY core-feed\/ \/core-feed\//);
  assert.doesNotMatch(dockerfile, /COPY .*curriculum/);
  for (const excluded of ["**/.git", "**/.local-content", "**/*progress*.json", "**/registry.json", "**/artifacts", "**/.env"]) assert.ok(ignore.includes(excluded));
  assert.match(prepare, /git -C "\$APP" archive HEAD/);
  assert.match(prepare, /requires clean committed application source/);
  assert.match(prepare, /WHACKSMACKER_CORE_PACKAGE_BASE_URL=file:\/\/\/core-feed\/packages\//);
  const feed = await readFile("scripts/build-core-review-feed.mjs", "utf8");
  assert.match(feed, /--production/);
  for (const kind of ["daily", "release"]) {
    const script = await readFile(`scripts/operations/whacksmacker-docker-${kind}.sh`, "utf8");
    for (const language of ["dutch", "vietnamese", "japanese", "korean"]) assert.ok(script.includes(`org.whacksmacker.content.${language}.revision`));
    assert.match(script, /prepare-docker-context.sh/);
    assert.match(script, /npm run test:docker/);
  }
});

test('publication verifies the top-level registry digest instead of a platform child',async()=>{
 for(const kind of ['daily','release']) {
  const source=await readFile(`scripts/operations/whacksmacker-docker-${kind}.sh`,'utf8');
  assert.match(source,/docker buildx imagetools inspect/);
  assert.doesNotMatch(source,/value\[0\]\?\.Descriptor/);
 }
});
