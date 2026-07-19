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
    assert.match(landing, /href="\/login"[^>]*>Log in</);
    assert.equal((landing.match(/href="\/login\?returnTo=\/app"/g) ?? []).length, 3);
    assert.match(landing, />GitHub</);
    assert.match(landing, />Developer notes</);
    assert.doesNotMatch(landing, /\/api\/state|Installed packages|Cards due/);
    const logo = await fetch(`${base}/assets/whacksmacker-logo.png`);
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get("content-type"), "image/png");
    assert.ok((await logo.arrayBuffer()).byteLength > 100_000);
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, service: "whacksmacker-web" });
    assert.match(await (await fetch(`${base}/app`)).text(), /Curriculum reader/);
    assert.match(await (await fetch(`${base}/login`)).text(), /id="ui-locale"/);
    assert.match(await (await fetch(`${base}/ui-locale.js`)).text(), /whacksmacker\.ui-locale/);
    assert.equal((await fetch(`${base}/landing.js`)).status, 200);
    const initial = await (await fetch(`${base}/api/state`)).json();
    assert.equal(initial.locale, "en-US");
    assert.deepEqual(initial.installed, []);
    const saved = await (await fetch(`${base}/api/settings`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: "zh-Hant-TW" }) })).json();
    assert.equal(saved.locale, "zh-TW");
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
    const appNavigation=await fetch(`${base}/app`,{redirect:"manual"});
    assert.equal(appNavigation.status,302);
    assert.equal(appNavigation.headers.get("location"),"/login?returnTo=/app");
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
    const visibleLogin = await fetch(`${base}/login`, { headers: { cookie: cookie?.split(";")[0] ?? "" }, redirect: "manual" });
    assert.equal(visibleLogin.status, 200);
    assert.match(await visibleLogin.text(), /id="login-form"/);
    assert.equal((await fetch(`${base}/app`, { headers: { cookie: cookie?.split(";")[0] ?? "" } })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("package includes public UI locale assets", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.ok(packageJson.files.includes("dist/apps/web"));
  assert.match(await readFile("apps/web/public/ui-locale.js", "utf8"), /zh-TW/);
  assert.match(await readFile("apps/web/public/landing.js", "utf8"), /installSelector/);
});

test("private reader restores URL state, persists locale, and renders unsafe Markdown as inert text", async () => {
  const html = await readFile("apps/web/public/index.html", "utf8");
  const appScript = await readFile("apps/web/public/app.js", "utf8");
  const dom = new JSDOM(html, { url: "http://127.0.0.1:8787/app", runScripts: "outside-only" });
  dom.window.document.cookie = "wsm_csrf=csrf-for-ui-test; Path=/";
  let locale = "en";
  const requests = [];
  const chapter={id:"units/core/chapter-010-ten/chapter.md",path:"units/core/chapter-010-ten/chapter.md",number:10,title:"Chapter Ten",packageVersion:"1.0.0"};
  const curriculum=()=>({moduleType:"language",packageId:"com.example.language",packageVersion:"1.0.0",name:"Example",targetLanguage:"nl",requestedSourceLocale:locale,effectiveSourceLocale:locale,overlayStatus:"active",chapters:[chapter]});
  dom.reconfigure({url:`http://127.0.0.1:8787/app?package=com.example.language&version=1.0.0&locale=en&chapter=${encodeURIComponent(chapter.id)}`});
  dom.window.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    if (path === "/api/settings") {
      assert.equal(options.method, "PUT");
      assert.equal(options.headers["X-CSRF-Token"], "csrf-for-ui-test");
      locale = JSON.parse(options.body).locale;
      return new Response(JSON.stringify({ locale }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if(path==="/api/state")return new Response(JSON.stringify({locale,user:{username:"account-a"}}),{status:200,headers:{"content-type":"application/json"}});
    if(path==="/api/curricula")return new Response(JSON.stringify({requestedSourceLocale:locale,curricula:[curriculum()]}),{status:200,headers:{"content-type":"application/json"}});
    if(String(path).startsWith("/api/curriculum/chapter?"))return new Response(JSON.stringify({curriculum:{...curriculum(),effectiveSourceLocale:undefined,overlayStatus:"missing"},chapter,text:"# Safe heading\n\n<script>bad()</script> [bad](javascript:alert(1)) [mixed](JaVaScRiPt:alert(1)) [encoded](java%73cript:alert(1)) [protocol](//evil.example)\n\n| A | B |\n|---|---|\n| 很長 | value |"}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error(`Unexpected request ${path}`);
  };
  dom.window.eval(appScript);
  await waitFor(()=>dom.window.document.querySelector("#chapter-title")?.textContent==="Chapter Ten",()=>dom.window.document.body.textContent);
  assert.equal(dom.window.document.querySelector("#chapter-content script"),null);
  assert.equal(dom.window.document.querySelector("#chapter-content a"),null);
  assert.match(dom.window.document.querySelector("#chapter-content").textContent,/<script>bad\(\)<\/script> bad/);
  assert.ok(dom.window.document.querySelector("#chapter-content table"));
  assert.equal(dom.window.document.activeElement.id,"reader");
  assert.match(dom.window.document.querySelector("#overlay").textContent,/No compatible English overlay/);
  const selector=dom.window.document.querySelector('input[name="source-locale"][value="zh-TW"]');selector.checked=true;selector.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
  await waitFor(()=>requests.some(request=>request.path==="/api/settings"));
  assert.deepEqual(JSON.parse(requests.find(request=>request.path==="/api/settings").options.body),{locale:"zh-TW"});
});

test("private reader refuses an unavailable exact-version deep link instead of substituting another version",async()=>{
  const html=await readFile("apps/web/public/index.html","utf8"),appScript=await readFile("apps/web/public/app.js","utf8");
  const dom=new JSDOM(html,{url:"http://127.0.0.1:8787/app?package=com.example.language&version=forged&locale=en",runScripts:"outside-only"});
  const curriculum={moduleType:"language",packageId:"com.example.language",packageVersion:"1.0.0",name:"Example",targetLanguage:"nl",requestedSourceLocale:"en",effectiveSourceLocale:"en",overlayStatus:"active",chapters:[]};
  const requests=[];dom.window.fetch=async path=>{requests.push(path);if(path==="/api/state")return new Response(JSON.stringify({locale:"en",user:{username:"account-a"}}),{status:200,headers:{"content-type":"application/json"}});if(path==="/api/curricula")return new Response(JSON.stringify({requestedSourceLocale:"en",curricula:[curriculum],unavailable:[]}),{status:200,headers:{"content-type":"application/json"}});throw new Error(`Unexpected request ${path}`)};
  dom.window.eval(appScript);
  await waitFor(()=>/not authorized/.test(dom.window.document.querySelector("#status")?.textContent??""),()=>dom.window.document.body.textContent);
  assert.equal(requests.some(path=>String(path).startsWith("/api/curriculum/chapter")),false);
  assert.equal(dom.window.location.search.includes("version=forged"),true);
});

async function waitFor(predicate, detail = () => "") {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for browser state: ${detail()}`);
}
