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
    assert.match(script, /--file "\$APP\/Dockerfile"/);
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
