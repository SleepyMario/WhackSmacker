import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("npm tarball includes geography map provenance data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-pack-test-"));

  try {
    const pack = await run("npm", ["pack", "--silent", "--ignore-scripts", "--pack-destination", directory], {
      npm_config_cache: join(directory, "npm-cache")
    });
    assert.equal(pack.exitCode, 0, pack.stderr);

    const packageName = pack.stdout.trim().split("\n").at(-1);
    assert.ok(packageName);

    const listing = await run("tar", ["-tf", join(directory, packageName)]);
    assert.equal(listing.exitCode, 0, listing.stderr);
    assert.match(listing.stdout, /package\/packages\/geography\/data\/continents\.provenance\.md/);
    assert.match(listing.stdout, /package\/dist\/packages\/geography\/data\/continents\.js/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function run(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`command timed out: ${command} ${args.join(" ")}`));
    }, 10000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}
