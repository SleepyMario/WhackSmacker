import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { parseWebOptions, startWebServer, webUsage } from "../dist/apps/web/server.js";

test("web options use localhost-safe defaults and validate ports", () => {
  assert.deepEqual(parseWebOptions([], {}), { password: undefined });
  assert.deepEqual(parseWebOptions(["--host", "127.0.0.1", "--port", "8787", "--data-dir", "/tmp/data"], {}), { host: "127.0.0.1", port: 8787, dataDir: "/tmp/data", password: undefined });
  assert.equal(parseWebOptions(["--help"], {}), "help");
  assert.match(webUsage, /default: 127\.0\.0\.1/);
  assert.throws(() => parseWebOptions(["--port", "0"], {}), /1 to 65535/);
});

test("PostgreSQL mode refuses an accidental unauthenticated public bind", async()=>{
  await assert.rejects(startWebServer({host:"0.0.0.0",port:0,databaseUrl:"postgresql://user:secret@127.0.0.1/database"}),/WHACKSMACKER_PUBLIC_URL/);
});

test("web server serves a data-free public landing page, logo, health, and private app", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-web-"));
  const server = await startWebServer({ host: "127.0.0.1", port: 0, dataDir: join(root, "content") });
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const landing = await (await fetch(base)).text();
    assert.match(landing, /Build knowledge that sticks/);
    assert.match(landing, /id="ui-locale"/);
    assert.match(landing, /value="en">English/);
    assert.match(landing, /value="zh-TW">中文（臺灣）/);
    assert.match(landing, /\/ui-locale\.js/);
    assert.match(landing, />Log in</);
    assert.match(landing, />GitHub</);
    assert.match(landing, />Developer notes</);
    assert.doesNotMatch(landing, /\/api\/state|Installed packages|Cards due/);
    const logo = await fetch(`${base}/assets/whacksmacker-logo.png`);
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get("content-type"), "image/png");
    assert.ok((await logo.arrayBuffer()).byteLength > 100_000);
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, service: "whacksmacker-web" });
    assert.match(await (await fetch(`${base}/app`)).text(), /Dashboard/);
    assert.match(await (await fetch(`${base}/login`)).text(), /id="ui-locale"/);
    assert.match(await (await fetch(`${base}/ui-locale.js`)).text(), /whacksmacker\.ui-locale/);
    assert.equal((await fetch(`${base}/landing.js`)).status, 200);
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

test("password mode keeps landing and health public while protecting app state", async () => {
  const server = await startWebServer({ host: "127.0.0.1", port: 0, password: "secret" });
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await fetch(`${base}/app`)).status, 401);
    assert.equal((await fetch(`${base}/api/state`)).status, 401);
    assert.equal((await fetch(`${base}/api/state`, { headers: { authorization: `Basic ${Buffer.from("user:secret").toString("base64")}` } })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("styled login creates a session without signup or default credentials", async () => {
  const server = await startWebServer({ host: "127.0.0.1", port: 0, password: "secret" });
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const page = await (await fetch(`${base}/login`)).text();
    assert.match(page, /There is no public registration or default account/);
    assert.doesNotMatch(page, /Sign up|Register/);
    assert.equal((await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "wrong" }) })).status, 401);
    const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "secret" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie ?? "", /wsm_session=.*HttpOnly.*SameSite=Strict/);
    assert.equal((await fetch(`${base}/app`, { headers: { cookie: cookie?.split(";")[0] ?? "" } })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("package includes public UI locale assets", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.ok(packageJson.files.includes("dist/apps/web"));
  assert.match(await readFile("apps/web/public/ui-locale.js", "utf8"), /zh-TW/);
  assert.match(await readFile("apps/web/public/landing.js", "utf8"), /installSelector/);
});

test("private source-language control mutates settings and rerenders the persisted locale", async () => {
  const html = await readFile("apps/web/public/index.html", "utf8");
  const localeScript = await readFile("apps/web/public/ui-locale.js", "utf8");
  const appScript = await readFile("apps/web/public/app.js", "utf8");
  const dom = new JSDOM(html, { url: "http://127.0.0.1:8787/app", runScripts: "outside-only" });
  dom.window.document.cookie = "wsm_csrf=csrf-for-ui-test; Path=/";
  let locale = "en-US";
  const requests = [];
  const state = () => ({ locale, theme: "light", user: { username: "account-a", role: "user" }, installed: [], available: [], decks: [], review: { total: 0, due: 0, reviewed: 0 } });
  dom.window.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    if (path === "/api/settings") {
      assert.equal(options.method, "PUT");
      assert.equal(options.headers["X-CSRF-Token"], "csrf-for-ui-test");
      locale = JSON.parse(options.body).locale;
      return new Response(JSON.stringify({ locale }), { status: 200, headers: { "content-type": "application/json" } });
    }
    assert.equal(path, "/api/state");
    return new Response(JSON.stringify(state()), { status: 200, headers: { "content-type": "application/json" } });
  };
  dom.window.eval(localeScript);
  dom.window.eval(appScript);
  await waitFor(() => [...dom.window.document.querySelectorAll(".metric")].some(node => node.textContent === "EN"), () => dom.window.document.querySelector("#app")?.textContent);
  const selector = dom.window.document.querySelector("#locale");
  selector.value = "zh-Hant-TW";
  selector.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await waitFor(() => [...dom.window.document.querySelectorAll(".metric")].some(node => node.textContent === "中文"), () => dom.window.document.querySelector("#app")?.textContent);
  assert.equal(selector.value, "zh-Hant-TW");
  assert.equal(dom.window.document.documentElement.lang, "zh-Hant-TW");
  assert.equal(dom.window.document.querySelector('[data-page="dashboard"] span').textContent, "儀表板");
  assert.deepEqual(JSON.parse(requests.find(request => request.path === "/api/settings").options.body), { locale: "zh-Hant-TW" });
  assert.equal(requests.filter(request => request.path === "/api/state").length, 2);
});

async function waitFor(predicate, detail = () => "") {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for browser state: ${detail()}`);
}
