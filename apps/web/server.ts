import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { parseChessArgs, renderChessCommand } from "../../packages/chess";
import { getContinentDefinitions, getContinentReviewCards, renderContinentMap } from "../../packages/geography";
import {
  fourFiveUnitDefinition,
  generateBeginnerVolumeOneWorkbookPdf,
  generateCountingUnitWorkbookPdf,
  oneToFiveUnitDefinition,
  oneTwoThreeUnitDefinition,
  sixToNineUnitDefinition
} from "../../packages/mathematics";
import {
  installContentPackage,
  listAvailableContentPackages,
  listInstalledContentPackages,
  listInstalledReadablePackages,
  listReadableContentEntries,
  readInstalledContentEntry,
  getInstalledLanguageCurriculum,
  readInstalledLanguageCurriculumChapter,
  listReadingReviewItems,
  listReadingReviewSources,
  loadReviewProgressStore,
  recordReadingReviewAnswer,
  removeContentPackage,
  removeReadingReviewProgressForPackage,
  syncReadingReviewItems,
  defaultReviewProgressDirectoryForContentDataDirectory,
  classifyReviewDeckMenuStatus,
  combineDeveloperGrammarMarkdown,
  createUserDataBackup,
  projectCurriculumMarkdown,
  restoreUserDataBackup,
  validateUserDataBackup,
  reviewIdentityKey,
  type CurriculumDisplayMode,
  type ReadingReviewItem,
  type ReviewItemIdentity,
  type ReviewRating
} from "../../packages/core";
import { defaultSettingsDirectoryForContentDataDirectory, loadSourceLanguageSettings, saveSourceLanguage } from "../../src/settings/source-language";
import { type SourceLocale } from "../../src/i18n";
import { assertDatabaseReady, authenticateUser, createDatabasePool, createSession, csrfMatches, databaseConfig, recordUserReview, resolveSession, revokeSession, selectedPackages, selectPackage, syncUserReviewStates, unselectPackage, updateUserSettings, userHasSelectedPackage, userSettings, type DatabaseSession } from "../../packages/storage/postgres";

export interface WebServerOptions { readonly host?: string; readonly port?: number; readonly dataDir?: string; readonly cataloguePath?: string; readonly password?: string; readonly databaseUrl?: string; readonly publicUrl?: string; readonly secureCookies?: boolean; readonly sessionTtl?: number; readonly trustProxy?: boolean; }
interface WebContext { readonly pool?: Pool; readonly sessions: Set<string>; readonly attempts: Map<string,{count:number;until:number;seen:number}>; packageMutation:Promise<void>; }
class HttpError extends Error { constructor(readonly status:number,message:string){super(message)} }
export const webUsage = `WhackSmacker Web GUI

Usage:
  whacksmacker web [--host 127.0.0.1] [--port 8787] [--data-dir <dir>] [--catalogue <catalogue.json>] [--password <password>]
  wsm web [options]

Options:
  --host HOST       Bind address (default: 127.0.0.1)
  --port PORT       TCP port (default: 8787)
  --data-dir DIR    Content data directory
  --catalogue FILE  Package catalogue JSON
  --password VALUE  Require HTTP Basic authentication (or WHACKSMACKER_WEB_PASSWORD)
  -h, --help        Show this help`;

const assets = join(__dirname, "public");

export async function startWebServer(options: WebServerOptions = {}): Promise<ReturnType<typeof createServer>> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const config = options.databaseUrl ? { ...(databaseConfig({ DATABASE_URL: options.databaseUrl })!), url: options.databaseUrl } : databaseConfig();
  if (config && host !== "127.0.0.1" && host !== "::1" && !options.publicUrl && !process.env.WHACKSMACKER_PUBLIC_URL) throw new Error("PostgreSQL web mode requires WHACKSMACKER_PUBLIC_URL before binding publicly.");
  if(config&&host!=="127.0.0.1"&&host!=="::1"&&!secureCookies(options)&&!loopbackPublicUrl(options))throw new Error("PostgreSQL public binding requires HTTPS public URL or WHACKSMACKER_SECURE_COOKIES=true.");
  const pool=config?createDatabasePool(config):undefined;if(pool){await assertDatabaseReady(pool);await pool.query("SELECT 1 FROM users LIMIT 1");}
  const context:WebContext={pool,sessions:new Set<string>(),attempts:new Map(),packageMutation:Promise.resolve()};
  const server = createServer((request, response) => void handle(request, response, options, context));
  server.on("close",()=>void pool?.end());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => { server.off("error", reject); resolve(); });
  });
  return server;
}

async function handle(request: IncomingMessage, response: ServerResponse, options: WebServerOptions, context: WebContext): Promise<void> {
  const requestId=randomUUID();response.setHeader("X-Request-Id",requestId);
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/api/health") return json(response, 200, { ok: true, service: "whacksmacker-web" });
    if (url.pathname === "/api/login" && request.method === "POST") return await login(request, response, options, context);
    const publicFiles: Record<string, [string, string]> = {
      "/": ["landing.html", "text/html; charset=utf-8"],
      "/login": ["login.html", "text/html; charset=utf-8"],
      "/landing.css": ["landing.css", "text/css; charset=utf-8"],
      "/landing.js": ["landing.js", "text/javascript; charset=utf-8"],
      "/login.js": ["login.js", "text/javascript; charset=utf-8"],
      "/ui-locale.js": ["ui-locale.js", "text/javascript; charset=utf-8"],
      "/assets/whacksmacker-logo.png": ["assets/whacksmacker-logo.png", "image/png"]
    };
    const publicFile = publicFiles[url.pathname];
    if (publicFile) return await staticFile(request, response, publicFile);
    const identity=await authorized(request,options,context);if(identity===false){if(url.pathname==="/app"){response.writeHead(302,securityHeaders({Location:`/login?returnTo=${encodeURIComponent(request.url??"/app")}`,"Cache-Control":"no-store"}));response.end();return}response.setHeader("WWW-Authenticate",'Session realm="WhackSmacker"');return json(response,401,{error:"Authentication required.",requestId})}
    if(context.pool&&isMutation(request)){if(!validOrigin(request,options)||!csrfMatches(String(request.headers["x-csrf-token"]??""),identity===true?"":identity.csrfTokenHash))return json(response,403,{error:"Request verification failed."})}
    if (url.pathname === "/api/logout" && request.method === "POST") return await logout(request,response,options,context,identity);
    if (url.pathname === "/api/state" && request.method === "GET") return json(response, 200, context.pool?await databaseState(options,context.pool,(identity as DatabaseSession)):await state(options));
    if (url.pathname === "/api/settings" && request.method === "PUT") return await updateSettings(request, response, options,context.pool,identity);
    if (url.pathname === "/api/modules" && request.method === "GET") return moduleCapabilities(response);
    if (url.pathname === "/api/chess" && request.method === "POST") return await chess(request, response);
    if (url.pathname === "/api/geography/continents" && request.method === "GET") return geographyContinents(url, response);
    if (url.pathname === "/api/mathematics/workbook" && request.method === "POST") return await mathematicsWorkbook(request, response);
    if (url.pathname === "/api/backup" && request.method === "GET") return await backupDownload(response, options, context.pool);
    if (url.pathname === "/api/backup/restore" && request.method === "POST") return await backupRestore(request, response, options, context.pool);
    if (url.pathname === "/api/packages/install" && request.method === "POST") return await install(request, response, options,context,identity);
    if (url.pathname === "/api/packages/remove" && request.method === "POST") return await remove(request, response, options,context.pool,identity);
    if (url.pathname === "/api/review/answer" && request.method === "POST") return await answer(request, response, options,context.pool,identity);
    if (url.pathname === "/api/review-items" && request.method === "GET") return await reviewItems(url, response, options,context.pool,identity);
    if (url.pathname === "/api/content" && request.method === "GET") return await content(url, response, options,context.pool,identity);
    if (url.pathname === "/api/content/entry" && request.method === "GET") return await contentEntry(url, response, options,context.pool,identity);
    if (url.pathname === "/api/curricula" && request.method === "GET") return await curricula(response,options,context.pool,identity);
    if (url.pathname === "/api/curriculum" && request.method === "GET") return await curriculum(url,response,options,context.pool,identity);
    if (url.pathname === "/api/curriculum/chapter" && request.method === "GET") return await curriculumChapter(url,response,options,context.pool,identity);
    const files: Record<string, [string, string]> = { "/app": ["index.html", "text/html; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/styles.css": ["styles.css", "text/css; charset=utf-8"] };
    const file = files[url.pathname];
    if (file) return await staticFile(request, response, file);
    json(response, 404, { error: "Not found." });
  } catch (error) { const status=error instanceof HttpError?error.status:error instanceof SyntaxError?400:isDatabaseError(error)?500:500;if(status===500)console.error(`[${requestId}] web request failed`,error);json(response,status,{error:status===500?"The server could not complete the request.":error instanceof SyntaxError?"Request body must be valid JSON.":(error as Error).message,requestId}); }
}

async function state(options: WebServerOptions) {
  const locale = (await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage;
  const installed = (await listInstalledContentPackages(options.dataDir)).filter(item => item.contentType !== "curriculum-source-language-pack");
  const available = options.cataloguePath ? (await listAvailableContentPackages(options.cataloguePath)).filter(item => item.contentType !== "curriculum-source-language-pack") : [];
  const now = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
  await syncReadingReviewItems({ dataDir: options.dataDir, now, sourceLocale: locale });
  const items = await listReadingReviewItems({ dataDir: options.dataDir, sourceLocale: locale });
  const progress = await loadReviewProgressStore(progressDir(options));
  const progressByKey = new Map(progress.items.map(item => [reviewIdentityKey(item), item]));
  const decks = (await listReadingReviewSources({ dataDir: options.dataDir, sourceLocale: locale })).map(source => {
    const deckItems = items.filter(item => item.packageId === source.packageId && item.packageVersion === source.packageVersion && item.sourcePath === source.sourcePath);
    const cardIdentities = deckItems.map(readingReviewIdentity);
    const states = cardIdentities.flatMap(identity => {
      const saved = progressByKey.get(reviewIdentityKey(identity));
      return saved === undefined ? [] : [saved];
    });
    const classification = classifyReviewDeckMenuStatus({
      deckId: `${source.packageId}@${source.packageVersion}#${source.sourcePath}`,
      cardIdentities,
      savedProgress: states,
      now
    });
    return {
      ...source,
      title: source.title ?? source.sourcePath.split("/").at(-2) ?? source.sourcePath,
      reviewed: states.filter(item => item.reviewCount > 0).length,
      due: classification.dueCardCount,
      status: classification.status
    };
  });
  return { locale, installed, available, decks, review: { total: progress.items.length, due: progress.items.filter(item => item.nextReviewAt <= now).length, reviewed: progress.items.filter(item => item.reviewCount > 0).length } };
}

async function databaseState(options:WebServerOptions,pool:Pool,user:DatabaseSession){const settings=await userSettings(pool,user.id),selected=await selectedPackages(pool,user.id),keys=new Set(selected.map(x=>x.package_id+"@"+x.package_version)),installed=(await listInstalledContentPackages(options.dataDir)).filter(x=>keys.has(x.packageId+"@"+x.packageVersion)&&x.contentType!=="curriculum-source-language-pack"),available=options.cataloguePath?(await listAvailableContentPackages(options.cataloguePath)).filter(x=>x.contentType!=="curriculum-source-language-pack"):[],now=new Date().toISOString().replace(/\.\d{3}Z$/u,"Z"),items=(await listReadingReviewItems({dataDir:options.dataDir,sourceLocale:settings.locale})).filter(x=>keys.has(x.packageId+"@"+x.packageVersion)),identities=items.map(readingReviewIdentity),states=await syncUserReviewStates(pool,user.id,identities,now),byKey=new Map(states.map(x=>[reviewIdentityKey(x),x])),sources=(await listReadingReviewSources({dataDir:options.dataDir,sourceLocale:settings.locale})).filter(x=>keys.has(x.packageId+"@"+x.packageVersion)),decks=sources.map(source=>{const deckItems=items.filter(x=>x.packageId===source.packageId&&x.packageVersion===source.packageVersion&&x.sourcePath===source.sourcePath),cardIdentities=deckItems.map(readingReviewIdentity),ss=cardIdentities.flatMap(identity=>{const saved=byKey.get(reviewIdentityKey(identity));return saved===undefined?[]:[saved]}),classification=classifyReviewDeckMenuStatus({deckId:`${source.packageId}@${source.packageVersion}#${source.sourcePath}`,cardIdentities,savedProgress:ss,now});return{...source,title:source.title??source.sourcePath,itemCount:deckItems.length,reviewed:ss.filter(x=>x.reviewCount>0).length,due:classification.dueCardCount,status:classification.status}}),activeStates=states.filter(x=>x.retiredAt===undefined);return{locale:settings.locale,theme:settings.theme,user:{username:user.username,role:user.role},csrfToken:undefined,installed,available,decks,review:{total:activeStates.length,due:activeStates.filter(x=>x.nextReviewAt<=now).length,reviewed:activeStates.filter(x=>x.reviewCount>0).length}}}

function readingReviewIdentity(item: ReadingReviewItem): ReviewItemIdentity {
  return {
    packageId: item.packageId,
    packageVersion: item.packageVersion,
    ...(item.sourcePath === undefined ? {} : { sourcePath: item.sourcePath }),
    itemId: item.item.id,
    ...(item.item.schemaVersion === 2 ? { pedagogicalFingerprint: item.item.pedagogicalFingerprint } : {})
  };
}

async function updateSettings(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const body=await bodyJson(req),locale=canonicalWebLocale(String(body.locale??""));if(locale!=="en"&&locale!=="zh-TW")throw new HttpError(400,"Unsupported source language.");const theme=body.theme===undefined?undefined:String(body.theme);if(theme!==undefined&&theme!=="light"&&theme!=="dark")throw new HttpError(400,"Unsupported theme.");if(pool)await updateUserSettings(pool,(id as DatabaseSession).id,locale,theme);else await saveSourceLanguage((locale==="en"?"en-US":"zh-Hant-TW") as SourceLocale,settingsDir(options));json(res,200,{locale,...(theme?{theme}:{})})}
async function install(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,context:WebContext,id:true|DatabaseSession){if(!options.cataloguePath)throw new HttpError(400,"Package catalogue is unavailable.");const body=await bodyJson(req);if("user_id"in body)throw new HttpError(400,"user_id is not accepted.");const result=await exclusivePackageMutation(context,()=>installContentPackage({cataloguePath:options.cataloguePath!,packageId:required(body.packageId),packageVersion:required(body.packageVersion),dataDir:options.dataDir}));if(context.pool)await selectPackage(context.pool,(id as DatabaseSession).id,result.record.packageId,result.record.packageVersion);json(res,200,result)}
async function exclusivePackageMutation<T>(context:WebContext,operation:()=>Promise<T>){const previous=context.packageMutation;let release!:()=>void;context.packageMutation=new Promise<void>(resolve=>{release=resolve});await previous;try{return await operation()}finally{release()}}
async function remove(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const body=await bodyJson(req),packageId=required(body.packageId),version=required(body.packageVersion);if(pool){await unselectPackage(pool,(id as DatabaseSession).id,packageId,version,body.keepProgress!==true);return json(res,200,{removed:true})}const result=await removeContentPackage({dataDir:options.dataDir,packageId,packageVersion:version});if(body.keepProgress!==true)await removeReadingReviewProgressForPackage({dataDir:options.dataDir,packageId,packageVersion:version,removedAt:new Date().toISOString()});json(res,200,result)}
async function answer(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const b=await bodyJson(req),rating=String(b.rating) as ReviewRating;if(!["again","hard","good","easy"].includes(rating))throw new HttpError(400,"Invalid rating.");const identity={packageId:required(b.packageId),packageVersion:required(b.packageVersion),sourcePath:required(b.sourcePath),itemId:required(b.itemId)},at=new Date().toISOString().replace(/\.\d{3}Z$/u,"Z");if(pool){const user=id as DatabaseSession;if(!await allowedPackage(pool,user.id,identity.packageId,identity.packageVersion))throw new HttpError(403,"This package version is not selected for your account.");const locale=(await userSettings(pool,user.id)).locale,items=await listReadingReviewItems({dataDir:options.dataDir,packageId:identity.packageId,sourceLocale:locale}),item=items.find(x=>x.packageVersion===identity.packageVersion&&x.sourcePath===identity.sourcePath&&x.item.id===identity.itemId);if(!item)throw new HttpError(404,"Review item not found.");return json(res,200,await recordUserReview(pool,user.id,{...identity,...(item.item.schemaVersion===2?{pedagogicalFingerprint:item.item.pedagogicalFingerprint}:{})},rating,at))}json(res,200,await recordReadingReviewAnswer({dataDir:options.dataDir,...identity,rating,reviewedAt:at}))}
async function allowedPackage(pool:Pool,userId:string,packageId:string,packageVersion:string){return userHasSelectedPackage(pool,userId,packageId,packageVersion)}
async function reviewItems(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const packageId=query(url,"packageId"),version=query(url,"version");if(pool&&!await allowedPackage(pool,(id as DatabaseSession).id,packageId,version))throw new HttpError(403,"This package version is not selected for your account.");const locale=pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage;json(res,200,{items:(await listReadingReviewItems({dataDir:options.dataDir,packageId,sourceLocale:locale})).filter(x=>x.packageVersion===version)})}
async function content(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const selected=url.searchParams.get("packageId"),allowed=pool?new Set((await selectedPackages(pool,(id as DatabaseSession).id)).map(x=>x.package_id+"@"+x.package_version)):undefined;if(selected){const version=query(url,"version");if(allowed&&!allowed.has(selected+"@"+version))throw new HttpError(403,"This package version is not selected for your account.");const locale=pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage,all=await listInstalledReadablePackages(options.dataDir,locale),packages=allowed?all.filter(x=>allowed.has(x.packageId+"@"+x.packageVersion)):all;return json(res,200,{packages,entries:await listReadableContentEntries(selected,options.dataDir,version)})}const locale=pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage,all=await listInstalledReadablePackages(options.dataDir,locale),packages=allowed?all.filter(x=>allowed.has(x.packageId+"@"+x.packageVersion)):all;json(res,200,{packages,entries:[]})}
async function contentEntry(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const packageId=query(url,"packageId"),version=query(url,"version");if(pool&&!await allowedPackage(pool,(id as DatabaseSession).id,packageId,version))throw new HttpError(403,"This package version is not selected for your account.");const locale=pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage;json(res,200,await readInstalledContentEntry({dataDir:options.dataDir,packageId,packageVersion:version,path:query(url,"path"),locale}))}

async function curricula(res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const locale=await requestLocale(pool,id,options),allRecords=await listInstalledContentPackages(options.dataDir),records=allRecords.filter(x=>x.contentType==="language-curriculum"),selections=pool?await selectedPackages(pool,(id as DatabaseSession).id):undefined,allowed=selections?new Set(selections.map(x=>x.package_id+"@"+x.package_version)):undefined,selected=allowed?records.filter(x=>allowed.has(x.packageId+"@"+x.packageVersion)):records,installedKeys=new Set(allRecords.map(x=>x.packageId+"@"+x.packageVersion)),views=[],unavailable=(selections??[]).filter(x=>!installedKeys.has(x.package_id+"@"+x.package_version)).map(x=>({packageId:x.package_id,packageVersion:x.package_version}));for(const record of selected){try{views.push(await getInstalledLanguageCurriculum(record.packageId,record.packageVersion,locale,options.dataDir))}catch(error){unavailable.push({packageId:record.packageId,packageVersion:record.packageVersion});console.error("Unable to derive installed curriculum",record.packageId,record.packageVersion,error)}}json(res,200,{requestedSourceLocale:locale,curricula:views,unavailable})}
async function curriculum(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const packageId=query(url,"packageId"),version=query(url,"version");await requireAllowed(pool,id,packageId,version);try{json(res,200,await getInstalledLanguageCurriculum(packageId,version,await requestLocale(pool,id,options),options.dataDir))}catch(error){throw classifyContentError(error)}}
async function curriculumChapter(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){
  const packageId=query(url,"packageId"),version=query(url,"version"),chapterId=query(url,"chapter");
  await requireAllowed(pool,id,packageId,version);
  try {
    const locale=await requestLocale(pool,id,options),mode=displayMode(url.searchParams.get("mode")),translations=booleanQuery(url,"translations"),breakdown=booleanQuery(url,"breakdown"),characters=booleanQuery(url,"characters");
    const result=await readInstalledLanguageCurriculumChapter({dataDir:options.dataDir,packageId,packageVersion:version,chapterId,requestedSourceLocale:locale});
    let markdown=result.text;
    const entries=await listReadableContentEntries(packageId,options.dataDir,version);
    const role=curriculumRole(result.chapter.path);
    if(mode==="developer"&&role==="grammar-easy"){
      const hardPath=result.chapter.path.replace(/-grammar-easy\//u,"-grammar-hard/");
      if(entries.some(entry=>entry.path===hardPath)){
        try{const hard=await readInstalledContentEntry({dataDir:options.dataDir,packageId,packageVersion:version,path:hardPath,locale});markdown=combineDeveloperGrammarMarkdown(markdown,hard.text)}catch{/* Keep the easy source if its paired expert source is unavailable. */}
      }
    }
    if(role==="reading"){
      const supportPath=result.chapter.path.replace(/chapter\.md$/u,"reading-support.json");
      if(entries.some(entry=>entry.path===supportPath)){
        try{const supportResult=await readInstalledContentEntry({dataDir:options.dataDir,packageId,packageVersion:version,path:supportPath,locale}),support=parseWebReadingSupport(supportResult.text);if(support)markdown=applyWebReadingSupport(markdown,support,{mode,breakdown,characters})}catch{/* Optional support must not hide the primary reading. */}
      }else{
        markdown=removeWebNamedSection(markdown,"Line-by-Line Breakdown");markdown=removeWebNamedSection(markdown,"Line-by-line Breakdown");
        if(!characters){for(const title of ["Sino-Vietnamese Vocabulary","Sino-Korean Vocabulary","Hanja","Character Notes"])markdown=removeWebNamedSection(markdown,title)}
        if(breakdown)markdown=insertWebBeforeExercises(markdown,"### Line-by-line Breakdown\n\nBreakdown unavailable for this chapter.")
      }
      if(translations){
        const translationPath=result.chapter.path.replace(/chapter\.md$/u,"reading-translation.en.json");let available=hasWebTranslation(markdown);
        if(entries.some(entry=>entry.path===translationPath)){
          try{const translationResult=await readInstalledContentEntry({dataDir:options.dataDir,packageId,packageVersion:version,path:translationPath,locale}),translation=parseWebTranslation(translationResult.text);if(translation){markdown=insertWebTranslation(markdown,translation);available=true}}catch{/* Optional translation must not hide the primary reading. */}
        }
        if(!available)markdown=`${markdown.trimEnd()}\n\n### Natural English Translation\n\nTranslation unavailable for this chapter.\n`;
      }
    }
    const text=projectCurriculumMarkdown(markdown,mode,{contentRole:role,translationsEnabled:translations});
    json(res,200,{...result,text,display:{mode,translations,breakdown,characters}});
  }catch(error){throw classifyContentError(error)}
}
async function requireAllowed(pool:Pool|undefined,id:true|DatabaseSession,packageId:string,version:string){if(pool&&!await allowedPackage(pool,(id as DatabaseSession).id,packageId,version))throw new HttpError(403,"This package version is not selected for your account.")}
async function requestLocale(pool:Pool|undefined,id:true|DatabaseSession,options:WebServerOptions){return canonicalWebLocale(pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage)}
function classifyContentError(error:unknown){const message=error instanceof Error?error.message:"";if(/not found|not a language curriculum/iu.test(message))return new HttpError(404,"The requested curriculum or chapter is unavailable.");if(/corrupt|unreadable|invalid/iu.test(message))return new HttpError(500,"Curriculum content could not be read.");return error}

function moduleCapabilities(res:ServerResponse){json(res,200,{modules:[
  {id:"language",displayName:"Languages",features:["curriculum-reader","review-decks","source-language","display-modes","translations","characters","breakdown"]},
  {id:"chess",displayName:"Chess",features:["uci-moves","legal-destinations","board-view"]},
  {id:"geography",displayName:"Geography",features:["continent-map","continent-review"]},
  {id:"mathematics",displayName:"Mathematics",features:["beginner-volume-one","unit-workbooks","reproducible-seeds"]},
  {id:"content",displayName:"Content packages",features:["available","install","installed","remove","read"]},
  {id:"backup",displayName:"Backup",features:["create","restore"]}
]})}
async function chess(req:IncomingMessage,res:ServerResponse){const body=await bodyJson(req),moves=Array.isArray(body.moves)?body.moves.map(String):[],legalSquare=body.legalSquare===undefined?undefined:String(body.legalSquare);const args=[...moves,...(legalSquare?["--legal",legalSquare]:[])];json(res,200,{text:renderChessCommand(parseChessArgs(args))})}
function geographyContinents(url:URL,res:ServerResponse){const definitions=getContinentDefinitions(),highlight=url.searchParams.get("highlight")??definitions[0]?.id??"africa",selected=definitions.find(item=>item.id===highlight||item.name.toLowerCase()===highlight.toLowerCase());if(!selected)throw new HttpError(400,"Unknown continent.");json(res,200,{continents:definitions.map(item=>({id:item.id,name:item.name})),cards:getContinentReviewCards(),highlighted:{id:selected.id,name:selected.name},map:renderContinentMap({highlight:selected.id,width:72,height:20,colorsEnabled:false})})}
async function mathematicsWorkbook(req:IncomingMessage,res:ServerResponse){const body=await bodyJson(req),workbook=required(body.workbook),seed=optionalPositiveInteger(body.seed,"seed"),directory=await mkdtemp(join(tmpdir(),"whacksmacker-web-math-")),outputPath=join(directory,`${workbook}.pdf`);try{if(workbook==="beginner-volume-one")await generateBeginnerVolumeOneWorkbookPdf({outputPath,seed,overwrite:true});else{const definitions={"one-two-three":oneTwoThreeUnitDefinition,"four-and-five":fourFiveUnitDefinition,"one-to-five":oneToFiveUnitDefinition,"six-to-nine":sixToNineUnitDefinition} as const,definition=definitions[workbook as keyof typeof definitions];if(!definition)throw new HttpError(400,"Unknown mathematics workbook.");await generateCountingUnitWorkbookPdf({outputPath,seed,overwrite:true},definition)}const data=await readFile(outputPath);binary(res,200,data,"application/pdf",`${workbook}.pdf`)}finally{await rm(directory,{recursive:true,force:true})}}
async function backupDownload(res:ServerResponse,options:WebServerOptions,pool:Pool|undefined){if(pool)throw new HttpError(400,"Filesystem backups are available only in local web mode. Hosted accounts are backed up by the server administrator.");const backup=await createUserDataBackup({dataDir:options.dataDir,settingsDir:settingsDir(options),createdAt:new Date().toISOString().replace(/\.\d{3}Z$/u,"Z")});const data=Buffer.from(`${JSON.stringify(backup,null,2)}\n`,"utf8");binary(res,200,data,"application/json; charset=utf-8",`whacksmacker-backup-${backup.createdAt.slice(0,10)}.json`)}
async function backupRestore(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined){if(pool)throw new HttpError(400,"Filesystem restore is available only in local web mode.");const body=await bodyJson(req,10*1024*1024),backup=body.backup,validation=validateUserDataBackup(backup);if(!validation.valid)throw new HttpError(400,`Invalid backup: ${validation.errors.join(" ")}`);const directory=await mkdtemp(join(tmpdir(),"whacksmacker-web-backup-")),backupPath=join(directory,"backup.json");try{await writeFile(backupPath,JSON.stringify(backup));json(res,200,await restoreUserDataBackup({backupPath,dataDir:options.dataDir,settingsDir:settingsDir(options),force:body.force===true}))}finally{await rm(directory,{recursive:true,force:true})}}
type WebTranslation={schemaVersion:1;id:string;language:"en";sourceLanguage:string;sourcePath:"chapter.md";sourceSection:string;readingType:"dialogue"|"narrative";turns?:readonly {speaker:string;text:string}[];paragraphs?:readonly string[]};
type WebReadingSupport={schemaVersion:1;sourcePath:"chapter.md";audienceSections:readonly {sourceHeading:string;normal:string;expert:string}[];breakdown?:{normal:string;expert:string};characters?:{heading:string;normal:string;expert:string}};
function displayMode(value:string|null):CurriculumDisplayMode{return value==="expert"||value==="developer"?value:"normal"}
function booleanQuery(url:URL,name:string){return url.searchParams.get(name)==="true"}
function curriculumRole(path:string):"reading"|"grammar-easy"|"grammar-hard"{if(/-grammar-easy\/(?:chapter|README)\.md$/u.test(path))return"grammar-easy";if(/-grammar-hard\/(?:chapter|README)\.md$/u.test(path))return"grammar-hard";return"reading"}
function parseWebTranslation(text:string):WebTranslation|undefined{try{const value=JSON.parse(text) as WebTranslation&Record<string,unknown>;if(value.schemaVersion!==1||value.language!=="en"||value.sourcePath!=="chapter.md"||(value.readingType!=="dialogue"&&value.readingType!=="narrative")||typeof value.sourceSection!=="string"||["introduction","context","setting","participants","sceneIntroduction"].some(key=>key in value))return undefined;if(value.readingType==="dialogue"&&(!Array.isArray(value.turns)||!value.turns.length||!value.turns.every(turn=>typeof turn.speaker==="string"&&typeof turn.text==="string")))return undefined;if(value.readingType==="narrative"&&(!Array.isArray(value.paragraphs)||!value.paragraphs.length||!value.paragraphs.every(paragraph=>typeof paragraph==="string")))return undefined;return value}catch{return undefined}}
function parseWebReadingSupport(text:string):WebReadingSupport|undefined{try{const value=JSON.parse(text) as WebReadingSupport;if(value.schemaVersion!==1||value.sourcePath!=="chapter.md"||!Array.isArray(value.audienceSections)||!value.audienceSections.every(section=>typeof section.sourceHeading==="string"&&typeof section.normal==="string"&&typeof section.expert==="string"))return undefined;return value}catch{return undefined}}
function applyWebReadingSupport(markdown:string,support:WebReadingSupport,options:{mode:CurriculumDisplayMode;breakdown:boolean;characters:boolean}){let output=markdown;for(const section of support.audienceSections){const grammar=section.sourceHeading==="New Grammar"||section.sourceHeading==="New Grammar / Pattern",body=options.mode==="developer"?(grammar?`### Grammar\n\n#### Normal\n\n${section.normal}\n\n#### Expert\n\n${section.expert}`:`### ${section.sourceHeading}: Normal\n\n${section.normal}\n\n### ${section.sourceHeading}: Expert\n\n${section.expert}`):`### ${grammar?"Grammar":section.sourceHeading}\n\n${options.mode==="expert"?section.expert:section.normal}`;output=replaceWebNamedSection(output,section.sourceHeading,body)}const embedded=webSectionBody(output,"Line-by-Line Breakdown")??webSectionBody(output,"Line-by-line Breakdown");output=removeWebNamedSection(output,"Line-by-Line Breakdown");output=removeWebNamedSection(output,"Line-by-line Breakdown");for(const title of ["Sino-Vietnamese Vocabulary","Sino-Korean Vocabulary","Hanja","Character Notes"])output=removeWebNamedSection(output,title);if(options.characters&&support.characters){const body=options.mode==="developer"?`### ${support.characters.heading}\n\n#### Normal\n\n${support.characters.normal}\n\n#### Expert\n\n${support.characters.expert}`:`### ${support.characters.heading}\n\n${options.mode==="expert"?support.characters.expert:support.characters.normal}`;output=insertWebAfterSection(output,"New Vocabulary",body)}if(options.breakdown){const body=support.breakdown===undefined?(embedded===undefined?"### Line-by-line Breakdown\n\nBreakdown unavailable for this chapter.":`### Line-by-line Breakdown\n\n${embedded}`):options.mode==="developer"?`### Line-by-line Breakdown: Normal\n\n${support.breakdown.normal}\n\n### Line-by-line Breakdown: Expert\n\n${support.breakdown.expert}`:`### Line-by-line Breakdown\n\n${options.mode==="expert"?support.breakdown.expert:support.breakdown.normal}`;output=insertWebBeforeExercises(output,body)}return output}
function webSectionRange(markdown:string,title:string){const lines=markdown.replace(/\r\n?/gu,"\n").split("\n"),escaped=title.replace(/[.*+?^${}()|[\]\\]/gu,"\\$&"),start=lines.findIndex(line=>new RegExp(`^#{1,6}\\s+${escaped}\\s*$`,"u").test(line.trim()));if(start<0)return undefined;const level=/^(#{1,6})/u.exec(lines[start]??"")?.[1]?.length??1,next=lines.findIndex((line,index)=>index>start&&(()=>{const nextLevel=/^(#{1,6})\s+/u.exec(line.trim())?.[1]?.length;return nextLevel!==undefined&&(title==="Brief Introduction"||nextLevel<=level)})());return{lines,start,end:next<0?lines.length:next}}
function webSectionBody(markdown:string,title:string){const range=webSectionRange(markdown,title);if(!range)return undefined;const body=range.lines.slice(range.start+1,range.end).join("\n").trim();return body||undefined}
function replaceWebNamedSection(markdown:string,title:string,replacement:string){const range=webSectionRange(markdown,title);return range?[...range.lines.slice(0,range.start),...replacement.split("\n"),...range.lines.slice(range.end)].join("\n"):markdown}
function removeWebNamedSection(markdown:string,title:string){const range=webSectionRange(markdown,title);return range?[...range.lines.slice(0,range.start),...range.lines.slice(range.end)].join("\n"):markdown}
function insertWebAfterSection(markdown:string,title:string,addition:string){const range=webSectionRange(markdown,title);return range?[...range.lines.slice(0,range.end),"",...addition.split("\n"),...range.lines.slice(range.end)].join("\n"):markdown}
function insertWebBeforeExercises(markdown:string,addition:string){const lines=markdown.replace(/\r\n?/gu,"\n").split("\n"),index=lines.findIndex(line=>/^##\s+Simple Exercises\s*$/iu.test(line.trim())),at=index<0?lines.length:index;return[...lines.slice(0,at),"",...addition.split("\n"),"",...lines.slice(at)].join("\n")}
function insertWebTranslation(markdown:string,translation:WebTranslation){const lines=markdown.replace(/\r\n?/gu,"\n").split("\n"),source=lines.findIndex(line=>line.trim()===`### ${translation.sourceSection}`);if(source<0)return markdown;const next=lines.findIndex((line,index)=>index>source&&/^###\s+/u.test(line));if(next<0)return markdown;const body=translation.readingType==="dialogue"?(translation.turns??[]).map(turn=>`${turn.speaker}: ${turn.text}`):translation.paragraphs??[];return[...lines.slice(0,next),"### Natural English Translation","",...body,"",...lines.slice(next)].join("\n")}
function hasWebTranslation(markdown:string){return/^#{1,6}\s+(?:Natural English Translation|English translation)\s*$/imu.test(markdown)}
function optionalPositiveInteger(value:unknown,name:string){if(value===undefined||value===null||value==="")return undefined;const number=Number(value);if(!Number.isSafeInteger(number)||number<=0)throw new HttpError(400,`${name} must be a positive integer.`);return number}
function settingsDir(options: WebServerOptions) { return options.dataDir ? defaultSettingsDirectoryForContentDataDirectory(options.dataDir) : undefined; }
function progressDir(options: WebServerOptions) { return options.dataDir ? defaultReviewProgressDirectoryForContentDataDirectory(options.dataDir) : undefined; }
async function authorized(req:IncomingMessage,options:WebServerOptions,ctx:WebContext):Promise<true|DatabaseSession|false>{const token=cookie(req,"wsm_session");if(ctx.pool)return token?await resolveSession(ctx.pool,token)??false:false;if(!options.password)return true;if(token&&ctx.sessions.has(token))return true;const value=req.headers.authorization;return !!value?.startsWith("Basic ")&&Buffer.from(value.slice(6),"base64").toString("utf8").split(":").slice(1).join(":")===options.password}
async function login(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,ctx:WebContext){const body=await bodyJson(req);if(ctx.pool){const username=String(body.username??""),address=effectiveAddress(req,options),key=username.normalize("NFKC").trim().toLowerCase()+"|"+address,attempt=ctx.attempts.get(key);if(attempt&&attempt.until>Date.now())return json(res,429,{error:"Invalid username or password."});const user=await authenticateUser(ctx.pool,username,String(body.password??""));if(!user){const count=(attempt?.count??0)+1;ctx.attempts.set(key,{count,until:Date.now()+Math.min(30000,500*2**Math.min(count,6)),seen:Date.now()});pruneAttempts(ctx.attempts);return json(res,401,{error:"Invalid username or password."})}ctx.attempts.delete(key);const ttl=validatedSessionTtl(options.sessionTtl??Number(process.env.WHACKSMACKER_SESSION_TTL??86400)),session=await createSession(ctx.pool,user,ttl,address,String(req.headers["user-agent"]??""));res.setHeader("Set-Cookie",[sessionCookie(session.token,ttl,options),csrfCookie(session.csrf,ttl,options)]);return json(res,200,{ok:true,authenticationRequired:true,username:user.username})}if(!options.password){res.setHeader("Set-Cookie","wsm_session=local; Path=/; HttpOnly; SameSite=Strict");return json(res,200,{ok:true,authenticationRequired:false})}if(body.password!==options.password)return json(res,401,{error:"Invalid credentials."});const token=randomUUID();ctx.sessions.add(token);res.setHeader("Set-Cookie",sessionCookie(token,86400,options));json(res,200,{ok:true,authenticationRequired:true})}
async function logout(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,ctx:WebContext,id:true|DatabaseSession){const token=cookie(req,"wsm_session");if(token){if(ctx.pool)await revokeSession(ctx.pool,token);else ctx.sessions.delete(token)}res.setHeader("Set-Cookie",["wsm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"+(secureCookies(options)?"; Secure":""),"wsm_csrf=; Path=/; SameSite=Strict; Max-Age=0"+(secureCookies(options)?"; Secure":"")]);json(res,200,{ok:true})}
function cookie(req: IncomingMessage, name: string) { for (const part of (req.headers.cookie ?? "").split(";")) { const [key, ...value] = part.trim().split("="); if (key === name) return value.join("="); } return undefined; }
function secureCookies(options:WebServerOptions){const publicUrl=options.publicUrl??process.env.WHACKSMACKER_PUBLIC_URL;return options.secureCookies===true||process.env.WHACKSMACKER_SECURE_COOKIES==="true"||(publicUrl?.startsWith("https://")??false)}
function loopbackPublicUrl(options:WebServerOptions){const publicUrl=options.publicUrl??process.env.WHACKSMACKER_PUBLIC_URL;if(!publicUrl)return false;const hostname=new URL(publicUrl).hostname;return hostname==="127.0.0.1"||hostname==="[::1]"||hostname==="localhost"}
function sessionCookie(token:string,ttl:number,options:WebServerOptions){return `wsm_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secureCookies(options)?"; Secure":""}`}
function csrfCookie(token:string,ttl:number,options:WebServerOptions){return `wsm_csrf=${token}; Path=/; SameSite=Strict; Max-Age=${ttl}${secureCookies(options)?"; Secure":""}`}
function isMutation(req:IncomingMessage){return !["GET","HEAD","OPTIONS"].includes(req.method??"GET")}
function validOrigin(req:IncomingMessage,options:WebServerOptions){const origin=req.headers.origin;if(!origin)return false;const expected=options.publicUrl??process.env.WHACKSMACKER_PUBLIC_URL;if(expected)return origin===new URL(expected).origin;const host=req.headers.host;return !!host&&origin===`http://${host}`}
function effectiveAddress(req:IncomingMessage,options:WebServerOptions){if(options.trustProxy||process.env.WHACKSMACKER_TRUST_PROXY==="true")return String(req.headers["x-forwarded-for"]??"").split(",")[0].trim()||req.socket.remoteAddress||"unknown";return req.socket.remoteAddress??"unknown"}
function pruneAttempts(map:Map<string,{count:number;until:number;seen:number}>){if(map.size<10000)return;for(const[k,v]of map)if(v.seen<Date.now()-3600000)map.delete(k);while(map.size>10000)map.delete(map.keys().next().value!)}
async function staticFile(req: IncomingMessage, res: ServerResponse, file: [string, string]) { const data = await readFile(join(assets, file[0])); res.writeHead(200, securityHeaders({ "Content-Type": file[1], "Content-Length": String(data.length), "Cache-Control": file[1] === "image/png" ? "public, max-age=86400" : "no-store" })); if (req.method !== "HEAD") res.end(data); else res.end(); }
async function bodyJson(req: IncomingMessage, maximumBytes=64*1024): Promise<Record<string, unknown>> { const chunks: Buffer[] = [];let size=0;for await (const chunk of req){const value=Buffer.from(chunk);size+=value.length;if(size>maximumBytes)throw new HttpError(400,"Request body too large.");chunks.push(value)}return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
function required(value: unknown): string { if (typeof value !== "string" || !value.trim()) throw new HttpError(400,"Missing required value."); return value; }
function query(url:URL,name:string){const value=url.searchParams.get(name)?.trim();if(!value)throw new HttpError(400,`${name} is required.`);return value}
function canonicalWebLocale(locale:string){return locale==="zh-Hant-TW"||locale==="zh-TW"?"zh-TW":locale==="en-US"||locale==="en"?"en":locale}
function securityHeaders(headers: Record<string, string>) { return { ...headers, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=()", "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'" }; }
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, securityHeaders({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })); res.end(JSON.stringify(value)); }
function binary(res:ServerResponse,status:number,value:Buffer,contentType:string,fileName:string){res.writeHead(status,securityHeaders({"Content-Type":contentType,"Content-Length":String(value.length),"Content-Disposition":`attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/gu,"-")}"`,"Cache-Control":"no-store"}));res.end(value)}
function isDatabaseError(error:unknown){return !!error&&typeof error==="object"&&("code" in error||"severity" in error)}
function validatedSessionTtl(value:number){if(!Number.isInteger(value)||value<300||value>2592000)throw new Error("WHACKSMACKER_SESSION_TTL must be 300-2592000 seconds.");return value}

export function parseWebOptions(args: readonly string[], env: Record<string, string | undefined> = process.env): WebServerOptions | "help" {
  const result: { host?: string; port?: number; dataDir?: string; cataloguePath?: string; password?: string; databaseUrl?:string;publicUrl?:string;secureCookies?:boolean;sessionTtl?:number;trustProxy?:boolean } = { password: env.DATABASE_URL?undefined:env.WHACKSMACKER_WEB_PASSWORD };
  if(env.DATABASE_URL)result.databaseUrl=env.DATABASE_URL;if(env.WHACKSMACKER_PUBLIC_URL)result.publicUrl=env.WHACKSMACKER_PUBLIC_URL;if(env.WHACKSMACKER_SECURE_COOKIES==="true")result.secureCookies=true;if(env.WHACKSMACKER_SESSION_TTL)result.sessionTtl=validatedSessionTtl(Number(env.WHACKSMACKER_SESSION_TTL));if(env.WHACKSMACKER_TRUST_PROXY==="true")result.trustProxy=true;
  for (let i = 0; i < args.length; i++) { const arg = args[i]; if (arg === "-h" || arg === "--help") return "help"; const value = args[++i]; if (!value) throw new Error(`${arg} requires a value.`); if (arg === "--host") result.host = value; else if (arg === "--port") { result.port = Number(value); if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535) throw new Error("--port must be an integer from 1 to 65535."); } else if (arg === "--data-dir") result.dataDir = value; else if (arg === "--catalogue") result.cataloguePath = value; else if (arg === "--password") result.password = value; else throw new Error(`Unknown web option: ${arg}`); }
  return result;
}
