import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve("scripts/deploy-production.sh");
const oldCore = "sleepiestmario/whacksmacker:old-core";
const oldCurricula = "sleepiestmario/whacksmacker-curricula:old-curricula";
const newCore = "sleepiestmario/whacksmacker:new-core";
const newCurricula = "sleepiestmario/whacksmacker-curricula:new-curricula";

async function fixture(scenario = "healthy") {
  const root = await mkdtemp(join(tmpdir(), "wsm-deploy-test-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(root, "compose.yaml"), "services:\n  app: {}\n  curricula: {}\n");
  await writeFile(join(root, ".env.production"), `WHACKSMACKER_IMAGE=${oldCore}\nWHACKSMACKER_CURRICULA_IMAGE=${oldCurricula}\nDATABASE_URL=postgresql://SECRET_MARKER@postgres/db\n`);
  await writeFile(join(root, "scenario"), scenario);
  await writeFile(join(root, "changed"), "0");
  const docker = `#!/bin/sh
set -eu
root=$FAKE_ROOT
printf '%s\\n' "$*" >> "$root/calls"
scenario=$(cat "$root/scenario")
if [ "$1" = inspect ]; then
  format=$3; id=$4
  case $format in
    *Config.Image*)
      case $id in *curricula*) printf '%s\\n' '${oldCurricula}' ;; *) printf '%s\\n' '${oldCore}' ;; esac ;;
    *State.Status*) printf '%s\\n' running ;;
    *State.Health*Log*) printf '%s\\n' 'health record redacted' ;;
    *State.Health*)
      changed=$(cat "$root/changed")
      if [ "$changed" = 1 ] && [ "$scenario" = unhealthy ]; then printf '%s\\n' unhealthy
      else printf '%s\\n' healthy; fi ;;
    *) printf '%s\\n' ok ;;
  esac
  exit 0
fi
[ "$1" = compose ]
shift
while [ "$#" -gt 0 ]; do
  case $1 in
    --project-directory|--env-file|-f) shift 2 ;;
    *) break ;;
  esac
done
case $1 in
  version|config) exit 0 ;;
  ps)
    service=$4
    changed=$(cat "$root/changed")
    if [ "$service" = curricula ]; then printf '%s\\n' old-curricula
    elif [ "$changed" = 1 ] && [ "$scenario" = timeout ]; then :
    elif [ "$changed" = 1 ]; then printf '%s\\n' new-app
    else printf '%s\\n' old-app; fi ;;
  up)
    if [ "\${WHACKSMACKER_IMAGE:-}" = '${oldCore}' ] && [ "\${WHACKSMACKER_CURRICULA_IMAGE:-}" = '${oldCurricula}' ]; then
      printf '%s\\n' rollback >> "$root/events"; printf 0 > "$root/changed"
    else
      printf '%s\\n' deploy >> "$root/events"; printf 1 > "$root/changed"
      [ "$scenario" != up-failure ] || exit 1
    fi ;;
  exec)
    url=; for value in "$@"; do url=$value; done
    printf 'health:%s\\n' "$url" >> "$root/events"
    changed=$(cat "$root/changed")
    [ "$scenario" != invalid-response ] || [ "$changed" != 1 ] || [ "$url" != 'http://127.0.0.1:8787/api/health' ] || exit 1
    [ "$scenario" != public-invalid ] || [ "$url" = 'http://127.0.0.1:8787/api/health' ] || exit 1 ;;
  logs) printf '%s\\n' 'safe recent log' ;;
  *) exit 2 ;;
esac
`;
  await writeFile(join(bin, "docker"), docker);
  await chmod(join(bin, "docker"), 0o755);
  return root;
}

function run(root, extra = [], env = {}) {
  return spawnSync("/bin/sh", [script, "--compose-file", join(root, "compose.yaml"), "--env-file", join(root, ".env.production"), "--backup-dir", join(root, "backups"), "--timeout", "0", "--poll-interval", "0", "--core-image", newCore, "--curricula-image", newCurricula, ...extra], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`, FAKE_ROOT: root, ...env },
  });
}

async function events(root) {
  return readFile(join(root, "events"), "utf8").catch(() => "");
}

test("healthy Docker state and in-container health succeed without host localhost", async () => {
  const root = await fixture();
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(await events(root), /health:http:\/\/127\.0\.0\.1:8787\/api\/health/);
  assert.doesNotMatch(await readFile(join(root, "calls"), "utf8"), /curl|wget/);
  assert.doesNotMatch(await readFile(join(root, "calls"), "utf8"), /172\.22\.0\.17/);
});

for (const [scenario, label] of [["unhealthy", "unhealthy container"], ["timeout", "container timeout"], ["up-failure", "failure after state change"], ["invalid-response", "invalid internal response"]]) {
  test(`${label} triggers EXIT rollback`, async () => {
    const root = await fixture(scenario);
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(await events(root), /deploy[\s\S]*rollback/);
    assert.match(result.stderr, /rollback succeeded/);
  });
}

test("preflight failure before arming does not roll back", async () => {
  const root = await fixture();
  await writeFile(join(root, ".env.production"), "");
  await chmod(join(root, ".env.production"), 0o000);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(await events(root), /rollback/);
});

test("helper exit after the state change still reaches EXIT rollback", async () => {
  const root = await fixture("public-invalid");
  const result = run(root, ["--public-url", "https://public.example"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /public \/api\/health response was invalid/);
  assert.match(await events(root), /deploy[\s\S]*rollback/);
});

test("successful deployment does not roll back and keeps new references", async () => {
  const root = await fixture();
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await events(root)).match(/rollback/g), null);
  const environment = await readFile(join(root, ".env.production"), "utf8");
  assert.match(environment, new RegExp(`WHACKSMACKER_IMAGE=${newCore}`));
  assert.match(environment, new RegExp(`WHACKSMACKER_CURRICULA_IMAGE=${newCurricula}`));
});

test("rollback restores exact configuration and both prior image references", async () => {
  const root = await fixture("unhealthy");
  const before = await readFile(join(root, ".env.production"));
  run(root);
  assert.deepEqual(await readFile(join(root, ".env.production")), before);
  assert.match(await events(root), /rollback/);
});

test("deployment and rollback never remove volumes or print secrets", async () => {
  const root = await fixture("unhealthy");
  const result = run(root);
  const all = `${result.stdout}${result.stderr}${await readFile(join(root, "calls"), "utf8")}`;
  assert.doesNotMatch(all, /down|-v|SECRET_MARKER/);
});

test("public URL verification is optional and configuration-driven", async () => {
  const withoutRoot = await fixture();
  assert.equal(run(withoutRoot).status, 0);
  assert.doesNotMatch(await events(withoutRoot), /public\.example/);
  const withRoot = await fixture();
  assert.equal(run(withRoot, [], { WHACKSMACKER_DEPLOY_PUBLIC_URL: "https://public.example" }).status, 0);
  assert.match(await events(withRoot), /health:https:\/\/public\.example\/api\/health/);
});

test("validate-only preflight never arms rollback or changes configuration", async () => {
  const root = await fixture();
  const before = await readFile(join(root, ".env.production"));
  const result = run(root, ["--validate-only"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readFile(join(root, ".env.production")), before);
  assert.doesNotMatch(await events(root), /deploy|rollback/);
});
