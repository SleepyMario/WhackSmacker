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
    assert.match(await (await fetch(`${base}/app`)).text(), /Curriculum Reader/i);
    assert.match(await (await fetch(`${base}/login`)).text(), /id="ui-locale"/);
    assert.match(await (await fetch(`${base}/ui-locale.js`)).text(), /whacksmacker\.ui-locale/);
    assert.equal((await fetch(`${base}/landing.js`)).status, 200);
    const initial = await (await fetch(`${base}/api/state`)).json();
    assert.equal(initial.locale, "en-US");
    assert.deepEqual(initial.installed, []);
    assert.deepEqual(await (await fetch(`${base}/api/review`)).json(),{packages:[],unavailable:[]});
    assert.equal((await fetch(`${base}/api/review/session?packageId=com.example.missing`)).status,400);
    const saved = await (await fetch(`${base}/api/settings`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: "zh-Hant-TW" }) })).json();
    assert.equal(saved.locale, "zh-TW");
    assert.equal((await (await fetch(`${base}/api/state`)).json()).locale, "zh-Hant-TW");
    assert.equal((await fetch(`${base}/api/curriculum?packageId=com.example.missing`)).status, 400);
    assert.equal((await fetch(`${base}/api/curriculum/chapter?packageId=com.example.missing&chapter=chapter.md`)).status, 400);
    assert.equal((await fetch(`${base}/api/curriculum/chapter?packageId=com.example.missing&version=1.0.0&chapter=chapter.md&mode=forged`)).status, 400);
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
    assert.match(appNavigation.headers.get("location")??"",/^\/login\?returnTo=/);
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
  assert.equal(dom.window.document.activeElement,dom.window.document.body,"URL restoration must not steal focus or scroll the reader into view");
  dom.window.document.querySelector("#chapters button").click();
  await waitFor(()=>dom.window.document.activeElement.id==="reader");
  assert.match(dom.window.document.querySelector("#overlay").textContent,/No compatible English overlay/);
  const selector=dom.window.document.querySelector("#source-locale");selector.value="zh-TW";selector.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
  await waitFor(()=>requests.some(request=>request.path==="/api/settings"));
  assert.deepEqual(JSON.parse(requests.find(request=>request.path==="/api/settings").options.body),{locale:"zh-TW",theme:"dark"});
  await waitFor(()=>dom.window.document.activeElement.id==="source-locale");
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

test("preferred shell exposes only Reader and Review while keeping later navigation inert",async()=>{
  const html=await readFile("apps/web/public/index.html","utf8");
  const dom=new JSDOM(html);
  const nav=dom.window.document.querySelector(".primary-nav");
  assert.deepEqual([...nav.querySelectorAll("a b")].map(item=>item.textContent.trim()),["Reader","Review"]);
  const planned=[...nav.querySelectorAll("button")];
  assert.ok(planned.length>=1);
  assert.ok(planned.every(button=>button.disabled&&button.getAttribute("aria-disabled")==="true"));
  assert.doesNotMatch(html,/CLI parity/iu);
});

test("preferred Review client keeps answers hidden, requires reveal, and suppresses duplicate grading",async()=>{
  const html=await readFile("apps/web/public/index.html","utf8"),appScript=await readFile("apps/web/public/app.js","utf8");
  const dom=new JSDOM(html,{url:"http://127.0.0.1:8787/app?view=review",runScripts:"outside-only"});
  dom.window.document.cookie="wsm_csrf=review-csrf; Path=/";
  let reveals=0,answers=0,complete=false;
  const reviewPackage={packageId:"com.example.reviews",packageVersion:"1.0.0",stablePackageId:"com.example.reading",name:"Example Review",scope:"ordinary",sources:[{sourcePath:"units/chapter.md",title:"Chapter",sourceExists:true,itemCount:1,due:complete?0:1,reviewed:complete?1:0,status:complete?"complete":"due"}]};
  dom.window.fetch=async(path,options={})=>{
    if(path==="/api/state")return Response.json({locale:"en",theme:"dark",user:{username:"learner"}});
    if(path==="/api/review")return Response.json({packages:[reviewPackage],unavailable:[]});
    if(String(path).startsWith("/api/review/session?"))return Response.json(complete?{packageId:reviewPackage.packageId,packageVersion:"1.0.0",sourcePath:"units/chapter.md",total:1,due:0,complete:true,sessionId:"session-one"}:{packageId:reviewPackage.packageId,packageVersion:"1.0.0",sourcePath:"units/chapter.md",total:1,due:1,complete:false,sessionId:"session-one",card:{itemId:"stable-card",title:"Unsafe <title>",kind:"basic-card",promptLines:["<img src=x onerror=alert(1)>"],hintLines:[],reviewCount:0}});
    if(path==="/api/review/reveal"){reveals+=1;assert.equal(options.headers["X-CSRF-Token"],"review-csrf");return Response.json({itemId:"stable-card",answerLines:["<script>inert()</script>"],noteLines:["This card prompts recall of internal metadata."],exampleLines:["Tôi là sinh viên.","Tôi là Maria Garcia.","Tôi là Nguyễn Minh Anh."],evidenceLines:["review-decks/cards.tsv:4"],sourceAvailable:true})}
    if(path==="/api/review/answer"){answers+=1;assert.equal(JSON.parse(options.body).sessionId,"session-one");await new Promise(resolve=>setTimeout(resolve,15));complete=true;return Response.json({state:{reviewCount:1}})}
    throw new Error(`Unexpected request ${path}`);
  };
  dom.window.eval(appScript);
  await waitFor(()=>dom.window.document.querySelector(".review-card")!==null);
  assert.equal(dom.window.document.querySelector(".review-answer"),null);
  dom.window.document.querySelector("#review-session").dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await waitFor(()=>dom.window.document.querySelector(".review-answer")!==null);
  assert.equal(reveals,1);
  assert.equal(dom.window.document.querySelector(".review-answer script"),null);
  assert.match(dom.window.document.querySelector(".review-answer").textContent,/<script>inert\(\)<\/script>/u);
  assert.match(dom.window.document.querySelector(".review-answer").textContent,/Examples/u);
  assert.deepEqual([...dom.window.document.querySelectorAll(".review-example")].map(item=>item.textContent),["Tôi là sinh viên.","Tôi là Maria Garcia.","Tôi là Nguyễn Minh Anh."]);
  assert.doesNotMatch(dom.window.document.querySelector(".review-answer").textContent,/prompts recall|cards\.tsv/iu);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(answers,0);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"1",bubbles:true}));
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"1",bubbles:true}));
  await waitFor(()=>answers===1&&/Session complete/.test(dom.window.document.querySelector("#review-session").textContent));
  assert.equal(answers,1);
});

test("private reader rejects a package-only deep link without silently choosing a version",async()=>{
  const html=await readFile("apps/web/public/index.html","utf8"),appScript=await readFile("apps/web/public/app.js","utf8");
  const dom=new JSDOM(html,{url:"http://127.0.0.1:8787/app?package=com.example.language&locale=en",runScripts:"outside-only"});
  const curriculum={moduleType:"language",packageId:"com.example.language",packageVersion:"1.0.0",name:"Example",targetLanguage:"nl",requestedSourceLocale:"en",effectiveSourceLocale:"en",overlayStatus:"active",chapters:[]};
  const requests=[];
  dom.window.fetch=async path=>{requests.push(path);if(path==="/api/state")return Response.json({locale:"en",user:{username:"account-a"}});if(path==="/api/curricula")return Response.json({requestedSourceLocale:"en",curricula:[curriculum],unavailable:[]});throw new Error(`Unexpected request ${path}`)};
  dom.window.eval(appScript);
  await waitFor(()=>/both package and exact version/.test(dom.window.document.querySelector("#status")?.textContent??""));
  assert.equal(requests.some(path=>String(path).startsWith("/api/curriculum/chapter")),false);
  assert.equal(dom.window.location.search.includes("package=com.example.language"),true);
});

test("private reader renders explicit no-curriculum and empty-chapter states",async()=>{
  const html=await readFile("apps/web/public/index.html","utf8"),appScript=await readFile("apps/web/public/app.js","utf8");
  {
    const dom=new JSDOM(html,{url:"http://127.0.0.1:8787/app",runScripts:"outside-only"});
    const requests=[];
    dom.window.fetch=async path=>{requests.push(path);if(path==="/api/state")return Response.json({locale:"en",user:{username:"account-a"}});if(path==="/api/curricula")return Response.json({requestedSourceLocale:"en",curricula:[],unavailable:[]});throw new Error(`Unexpected request ${path}`)};
    dom.window.eval(appScript);
    await waitFor(()=>/No language curricula are selected/.test(dom.window.document.querySelector("#status")?.textContent??""));
    assert.equal(dom.window.document.querySelector("#controls").hidden,false);
    assert.equal(dom.window.document.querySelector("#curriculum").disabled,true);
    assert.equal(dom.window.document.querySelector("#reader").hidden,false);
    assert.match(dom.window.document.querySelector("#chapter-content").textContent,/No language curricula are selected/);
    assert.equal(requests.some(path=>String(path).startsWith("/api/curriculum/chapter")),false);
  }
  {
    const chapter={id:"units/core/chapter-001-empty/chapter.md",path:"units/core/chapter-001-empty/chapter.md",number:1,title:"Empty chapter",packageVersion:"1.0.0"};
    const curriculum={moduleType:"language",packageId:"com.example.empty",packageVersion:"1.0.0",name:"Empty",targetLanguage:"nl",requestedSourceLocale:"en",effectiveSourceLocale:"en",overlayStatus:"active",chapters:[chapter]};
    const dom=new JSDOM(html,{url:`http://127.0.0.1:8787/app?package=${curriculum.packageId}&version=1.0.0&locale=en&chapter=${encodeURIComponent(chapter.id)}`,runScripts:"outside-only"});
    dom.window.fetch=async path=>{if(path==="/api/state")return Response.json({locale:"en",user:{username:"account-a"}});if(path==="/api/curricula")return Response.json({requestedSourceLocale:"en",curricula:[curriculum],unavailable:[]});if(String(path).startsWith("/api/curriculum/chapter?"))return Response.json({curriculum,chapter,text:" \n"});throw new Error(`Unexpected request ${path}`)};
    dom.window.eval(appScript);
    await waitFor(()=>/no readable content/.test(dom.window.document.querySelector("#chapter-content")?.textContent??""));
    assert.match(dom.window.document.querySelector("#status").textContent,/no readable content/);
    assert.equal(dom.window.document.querySelector("#reader").hidden,false);
  }
});

test("reader distinguishes unavailable curriculum reasons and keeps a valid curriculum usable beside an invalid one",async()=>{
  const html=await readFile("apps/web/public/index.html","utf8"),appScript=await readFile("apps/web/public/app.js","utf8");
  const messages={
    "not-installed":/not installed/iu,
    "incompatible-legacy":/incompatible legacy package format/iu,
    corrupt:/package is corrupt/iu,
    "unreadable-current":/failed learner-reading validation/iu
  };
  for(const [reason,expected] of Object.entries(messages)){
    const dom=new JSDOM(html,{url:"http://127.0.0.1:8787/app",runScripts:"outside-only"});
    dom.window.fetch=async path=>{
      if(path==="/api/state")return Response.json({locale:"en",user:{username:"account-a"}});
      if(path==="/api/curricula")return Response.json({requestedSourceLocale:"en",curricula:[],unavailable:[{packageId:"com.example.invalid",packageVersion:"1.0.0",reason}]});
      throw new Error(`Unexpected request ${path}`);
    };
    dom.window.eval(appScript);
    await waitFor(()=>expected.test(dom.window.document.querySelector("#status")?.textContent??""));
  }

  const valid={moduleType:"language",packageId:"com.example.valid",packageVersion:"1.0.0",name:"Valid",targetLanguage:"vi",requestedSourceLocale:"en",overlayStatus:"missing",chapters:[]};
  const dom=new JSDOM(html,{url:"http://127.0.0.1:8787/app",runScripts:"outside-only"});
  dom.window.fetch=async path=>{
    if(path==="/api/state")return Response.json({locale:"en",user:{username:"account-a"}});
    if(path==="/api/curricula")return Response.json({requestedSourceLocale:"en",curricula:[valid],unavailable:[{packageId:"com.example.invalid",packageVersion:"0.9.0",reason:"corrupt"}]});
    throw new Error(`Unexpected request ${path}`);
  };
  dom.window.eval(appScript);
  await waitFor(()=>dom.window.document.querySelector("#curriculum-availability")?.hidden===false);
  assert.match(dom.window.document.querySelector("#curriculum-availability").textContent,/valid curriculum is available.*package is corrupt/iu);
  assert.equal(dom.window.document.querySelector("#curriculum").value,valid.packageId);
});

test("light sidebar uses neutral accessible tokens while approved dark token values stay exact",async()=>{
  const css=await readFile("apps/web/public/styles.css","utf8");
  const dark={
    "sidebar-bg":"#07101b","sidebar-border":"#24324a","sidebar-text":"#aeb8c8","sidebar-muted":"#7f8a9b","sidebar-icon":"#9150dc",
    "sidebar-hover-border":"#263750","sidebar-hover-bg":"#0c1828","sidebar-active-border":"#6930ad","sidebar-active-from":"#28134f","sidebar-active-to":"#16152c",
    "sidebar-footer-bg":"#0a1422","sidebar-footer-border":"#263750","sidebar-footer-muted":"#9faabb"
  };
  const light={
    "sidebar-bg":"#3f464d","sidebar-border":"#59636d","sidebar-text":"#f2f4f6","sidebar-muted":"#d1d6db","sidebar-icon":"#d6b4ff",
    "sidebar-hover-border":"#77818b","sidebar-hover-bg":"#49515a","sidebar-active-border":"#c98cff","sidebar-active-from":"#515a63","sidebar-active-to":"#474f57",
    "sidebar-footer-bg":"#454d55","sidebar-footer-border":"#707a84","sidebar-footer-muted":"#d1d6db"
  };
  const rootBlock=/:root\s*\{([\s\S]*?)\n\}/u.exec(css)?.[1]??"";
  const lightBlock=/html\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/u.exec(css)?.[1]??"";
  for(const [name,value] of Object.entries(dark))assert.match(rootBlock,new RegExp(`--${name}:\\s*${value}`,"u"));
  for(const [name,value] of Object.entries(light))assert.match(lightBlock,new RegExp(`--${name}:\\s*${value}`,"u"));
  assert.ok(contrast(light["sidebar-text"],light["sidebar-bg"])>=4.5);
  assert.ok(contrast(light["sidebar-muted"],light["sidebar-bg"])>=4.5);
  assert.ok(contrast("#ffffff",light["sidebar-active-from"])>=4.5);
  assert.ok(contrast("#ffffff",light["sidebar-active-to"])>=4.5);
  assert.ok(contrast("#c074ff",light["sidebar-bg"])>=3);
});

async function waitFor(predicate, detail = () => "") {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for browser state: ${detail()}`);
}

function contrast(foreground,background){
  const luminance=value=>{
    const components=value.slice(1).match(/../gu).map(part=>Number.parseInt(part,16)/255).map(part=>part<=0.04045?part/12.92:((part+0.055)/1.055)**2.4);
    return 0.2126*components[0]+0.7152*components[1]+0.0722*components[2];
  };
  const left=luminance(foreground),right=luminance(background);
  return (Math.max(left,right)+0.05)/(Math.min(left,right)+0.05);
}
