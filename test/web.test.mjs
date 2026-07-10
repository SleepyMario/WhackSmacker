import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseWebOptions, startWebServer, webUsage } from "../dist/apps/web/server.js";

test("web options use localhost-safe defaults and validate ports", () => {
  assert.deepEqual(parseWebOptions([], {}), { password: undefined });
  assert.deepEqual(parseWebOptions(["--host", "127.0.0.1", "--port", "8787", "--data-dir", "/tmp/data"], {}), { host: "127.0.0.1", port: 8787, dataDir: "/tmp/data", password: undefined });
  assert.equal(parseWebOptions(["--help"], {}), "help");
  assert.match(webUsage, /default: 127\.0\.0\.1/);
  assert.throws(() => parseWebOptions(["--port", "0"], {}), /1 to 65535/);
});

test("web server serves local assets, health, state, and persists locale", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-web-"));
  const server = await startWebServer({ host: "127.0.0.1", port: 0, dataDir: join(root, "content") });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    assert.match(await (await fetch(base)).text(), /WhackSmacker/);
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, service: "whacksmacker-web" });
    const initial = await (await fetch(`${base}/api/state`)).json();
    assert.equal(initial.locale, "en-US");
    assert.deepEqual(initial.installed, []);
    const saved = await (await fetch(`${base}/api/settings`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: "zh-Hant-TW" }) })).json();
    assert.equal(saved.locale, "zh-Hant-TW");
    assert.equal((await (await fetch(`${base}/api/state`)).json()).locale, "zh-Hant-TW");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("web password requires HTTP Basic authentication", async () => {
  const server = await startWebServer({ host: "127.0.0.1", port: 0, password: "secret" });
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/api/health`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { authorization: `Basic ${Buffer.from("user:secret").toString("base64")}` } })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
