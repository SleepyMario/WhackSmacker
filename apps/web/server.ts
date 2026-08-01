import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  installContentPackage,
  listAvailableContentPackages,
  listInstalledContentPackages,
  listInstalledReadablePackages,
  listReadableContentEntries,
  readInstalledContentEntry,
  getInstalledLanguageCurriculum,
  readInstalledLanguageCurriculumChapter,
  combineDeveloperGrammarMarkdown,
  parseReadingSupport as parseSharedReadingSupport,
  parseStructuredReadingTranslation as parseSharedStructuredReadingTranslation,
  projectCurriculumMarkdown,
  projectReadingChapterMarkdown,
  listReadingReviewItems,
  listReadingReviewSources,
  readingReviewSourcesFromItems,
  orderReadingReviewItemsForSession,
  loadReviewProgressStore,
  listDueReviewStates,
  recordStoredReviewOutcome,
  renderMemorizationExercise,
  removeContentPackage,
  removeReadingReviewProgressForPackage,
  syncReadingReviewItems,
  defaultReviewProgressDirectoryForContentDataDirectory,
  classifyReviewDeckMenuStatus,
  reviewIdentityKey,
  InstalledCurriculumUnavailableError,
  type CurriculumContentRole,
  type CurriculumDisplayMode,
  type ReadingSupport,
  type StructuredReadingTranslation,
  type ReadingReviewItem,
  type InstalledPackageRecord,
  type ReviewItemIdentity,
  type ReviewItemState,
  type ReviewRating
} from "../../packages/core";
import { defaultSettingsDirectoryForContentDataDirectory, loadSourceLanguageSettings, saveSourceLanguage } from "../../src/settings/source-language";
import { type SourceLocale } from "../../src/i18n";
import { assertDatabaseReady, authenticateUser, createDatabasePool, createSession, csrfMatches, databaseConfig, recordUserReview, resolveSession, revokeSession, selectedPackages, selectPackage, StaleReviewStateError, syncUserReviewStates, unselectPackage, updateUserSettings, userHasSelectedPackage, userSettings, type DatabaseSession } from "../../packages/storage/postgres";

export interface WebServerOptions { readonly host?: string; readonly port?: number; readonly dataDir?: string; readonly cataloguePath?: string; readonly password?: string; readonly databaseUrl?: string; readonly publicUrl?: string; readonly secureCookies?: boolean; readonly sessionTtl?: number; readonly trustProxy?: boolean; readonly reviewRandom?:()=>number; }
interface WebReviewSession { readonly owner:string; readonly packageId:string; readonly packageVersion:string; readonly sourcePath:string; itemIds:string[]; touchedAt:number; }
interface WebContext { readonly pool?: Pool; readonly sessions: Set<string>; readonly attempts: Map<string,{count:number;until:number;seen:number}>; readonly reviewSessions:Map<string,WebReviewSession>; packageMutation:Promise<void>; }
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
  const context:WebContext={pool,sessions:new Set<string>(),attempts:new Map(),reviewSessions:new Map(),packageMutation:Promise.resolve()};
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
    if(url.pathname==="/login"&&request.method==="GET"&&cookie(request,"wsm_session")){const existing=await authorized(request,options,context);if(existing!==false){response.writeHead(302,securityHeaders({Location:"/app","Cache-Control":"no-store"}));response.end();return}}
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
    if (url.pathname === "/api/packages/install" && request.method === "POST") return await install(request, response, options,context,identity);
    if (url.pathname === "/api/packages/remove" && request.method === "POST") return await remove(request, response, options,context.pool,identity);
    if (url.pathname === "/api/review" && request.method === "GET") return await reviewDiscovery(response,options,context.pool,identity);
    if (url.pathname === "/api/review/session" && request.method === "GET") return await reviewSession(url,response,options,context,identity);
    if (url.pathname === "/api/review/reveal" && request.method === "POST") return await revealReview(request,response,options,context.pool,identity);
    if (url.pathname === "/api/review/answer" && request.method === "POST") return await answer(request, response, options,context,identity);
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

async function databaseState(options:WebServerOptions,pool:Pool,user:DatabaseSession){const settings=await userSettings(pool,user.id),selected=await selectedPackages(pool,user.id),keys=new Set(selected.map(x=>x.package_id+"@"+x.package_version)),installed=(await listInstalledContentPackages(options.dataDir)).filter(x=>keys.has(x.packageId+"@"+x.packageVersion)&&x.contentType!=="curriculum-source-language-pack"),available=options.cataloguePath?(await listAvailableContentPackages(options.cataloguePath)).filter(x=>x.contentType!=="curriculum-source-language-pack"):[],now=new Date().toISOString().replace(/\.\d{3}Z$/u,"Z"),items=(await listReadingReviewItems({dataDir:options.dataDir,sourceLocale:settings.locale})).filter(x=>keys.has(x.reviewPackageId+"@"+x.packageVersion)),identities=items.map(readingReviewIdentity),states=await syncUserReviewStates(pool,user.id,identities,now),byKey=new Map(states.map(x=>[reviewIdentityKey(x),x])),sources=readingReviewSourcesFromItems(items,settings.locale),decks=sources.map(source=>{const deckItems=items.filter(x=>x.packageId===source.packageId&&x.packageVersion===source.packageVersion&&x.sourcePath===source.sourcePath),cardIdentities=deckItems.map(readingReviewIdentity),ss=cardIdentities.flatMap(identity=>{const saved=byKey.get(reviewIdentityKey(identity));return saved===undefined?[]:[saved]}),classification=classifyReviewDeckMenuStatus({deckId:`${source.packageId}@${source.packageVersion}#${source.sourcePath}`,cardIdentities,savedProgress:ss,now});return{...source,title:source.title??source.sourcePath,itemCount:deckItems.length,reviewed:ss.filter(x=>x.reviewCount>0).length,due:listDueReviewStates(ss,now).length,status:classification.status}}),activeStates=states.filter(x=>x.retiredAt===undefined);return{locale:settings.locale,theme:settings.theme,user:{username:user.username,role:user.role},csrfToken:undefined,installed,available,decks,review:{total:activeStates.length,due:activeStates.filter(x=>x.nextReviewAt<=now).length,reviewed:activeStates.filter(x=>x.reviewCount>0).length}}}

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
interface ReviewPackageBundle {
  readonly record: InstalledPackageRecord;
  readonly items: readonly ReadingReviewItem[];
  readonly scope: "ordinary" | "specialized";
}

function isReviewPackage(record:InstalledPackageRecord){return record.capabilities?.includes("core-review")===true||record.capabilities?.includes("specialized-review")===true||(record.capabilities===undefined&&record.contentType==="language-curriculum")}
function reviewScope(record:InstalledPackageRecord):"ordinary"|"specialized"{return record.capabilities?.includes("specialized-review")===true||record.contentType==="specialized-review"?"specialized":"ordinary"}
function reviewStablePackageId(record:InstalledPackageRecord){return record.capabilities?.includes("core-review")===true?(record.relatedPackageIds?.[0]??record.packageId):record.packageId}
function localizedName(value:unknown,locale:string){if(typeof value==="string")return value;if(value&&typeof value==="object"){const names=value as Record<string,unknown>;for(const key of [locale,locale==="zh-TW"?"zh-Hant-TW":"en-US","en","default"])if(typeof names[key]==="string")return names[key] as string}return "Review package"}

async function exactReviewPackage(options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession,packageId:string,version:string):Promise<ReviewPackageBundle>{
  if(pool&&!await allowedPackage(pool,(id as DatabaseSession).id,packageId,version))throw new HttpError(403,"This exact Review package version is not selected for your account.");
  const record=(await listInstalledContentPackages(options.dataDir)).find(item=>item.packageId===packageId&&item.packageVersion===version);
  if(!record)throw new HttpError(pool?409:404,"The exact Review package version is unavailable.");
  if(!isReviewPackage(record))throw new HttpError(404,"The exact package version does not provide Review cards.");
  try{
    const items=(await listReadingReviewItems({dataDir:options.dataDir,packageId:record.packageId,packageVersion:record.packageVersion,sourceLocale:await requestLocale(pool,id,options)})).filter(item=>item.reviewPackageId===record.packageId&&item.packageVersion===record.packageVersion);
    return{record,items,scope:reviewScope(record)};
  }catch{throw new HttpError(500,"Review package content could not be read.")}
}

async function reviewStates(options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession,items:readonly ReadingReviewItem[],now:string):Promise<readonly ReviewItemState[]>{
  const identities=items.map(readingReviewIdentity);
  if(pool)return syncUserReviewStates(pool,(id as DatabaseSession).id,identities,now);
  return(await syncReadingReviewItems({dataDir:options.dataDir,now,reviewItems:items})).store.items;
}

async function reviewDiscovery(res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){
  const locale=await requestLocale(pool,id,options),installed=await listInstalledContentPackages(options.dataDir),selected=pool?await selectedPackages(pool,(id as DatabaseSession).id):undefined,allowed=selected?new Set(selected.map(item=>`${item.package_id}@${item.package_version}`)):undefined;
  const records=installed.filter(isReviewPackage).filter(record=>allowed===undefined||allowed.has(`${record.packageId}@${record.packageVersion}`)).sort((left,right)=>left.packageId.localeCompare(right.packageId)||left.packageVersion.localeCompare(right.packageVersion));
  const bundles:ReviewPackageBundle[]=[],unavailable:{packageId:string;packageVersion:string}[]=[];
  for(const record of records){try{const bundle=await exactReviewPackage(options,pool,id,record.packageId,record.packageVersion);if(record.capabilities?.some(capability=>capability==="core-review"||capability==="specialized-review")||bundle.items.length>0)bundles.push(bundle)}catch{unavailable.push({packageId:record.packageId,packageVersion:record.packageVersion})}}
  const now=new Date().toISOString().replace(/\.\d{3}Z$/u,"Z"),items=bundles.flatMap(bundle=>bundle.items),states=await reviewStates(options,pool,id,items,now),byKey=new Map(states.map(state=>[reviewIdentityKey(state),state]));
  const packages=bundles.map(bundle=>{
    const sources=readingReviewSourcesFromItems(bundle.items,locale).map(source=>{
      const sourceItems=bundle.items.filter(item=>item.sourcePath===source.sourcePath),identities=sourceItems.map(readingReviewIdentity),saved=identities.flatMap(identity=>{const state=byKey.get(reviewIdentityKey(identity));return state===undefined?[]:[state]}),classification=classifyReviewDeckMenuStatus({deckId:`${bundle.record.packageId}@${bundle.record.packageVersion}#${source.sourcePath}`,cardIdentities:identities,savedProgress:saved,now});
      return{sourcePath:source.sourcePath,title:source.title??source.sourcePath,sourceExists:source.sourceExists,itemCount:source.itemCount,due:listDueReviewStates(saved,now).length,reviewed:saved.filter(state=>state.reviewCount>0).length,status:classification.status};
    });
    return{packageId:bundle.record.packageId,packageVersion:bundle.record.packageVersion,stablePackageId:reviewStablePackageId(bundle.record),name:localizedName(bundle.record.displayName,locale),scope:bundle.scope,relatedPackageIds:bundle.record.relatedPackageIds??[],sources};
  });
  json(res,200,{packages,unavailable});
}

function reviewItemFor(bundle:ReviewPackageBundle,sourcePath:string,itemId:string){return bundle.items.find(item=>item.sourcePath===sourcePath&&item.item.id===itemId)}
function activeStateFor(item:ReadingReviewItem,states:readonly ReviewItemState[]){return states.find(state=>reviewIdentityKey(state)===reviewIdentityKey(readingReviewIdentity(item)))}
function retiredStateFor(bundle:ReviewPackageBundle,sourcePath:string,itemId:string,states:readonly ReviewItemState[]){const stablePackageId=reviewStablePackageId(bundle.record);return states.find(state=>state.packageId===stablePackageId&&state.packageVersion===bundle.record.packageVersion&&state.sourcePath===sourcePath&&state.itemId===itemId&&state.retiredAt!==undefined)}
function reviewCard(item:ReadingReviewItem,state:ReviewItemState,locale:string){const rendered=renderMemorizationExercise({packageId:item.packageId,packageVersion:item.packageVersion,itemId:item.item.id,item:item.item,sourceLocale:locale});return{itemId:item.item.id,title:rendered.title,kind:rendered.kind,promptLanguage:rendered.promptLanguage,promptLines:rendered.promptLines,hintLines:rendered.hintLines,reviewCount:state.reviewCount}}

async function reviewSession(url:URL,res:ServerResponse,options:WebServerOptions,context:WebContext,id:true|DatabaseSession){
  const packageId=query(url,"packageId"),version=query(url,"version"),sourcePath=query(url,"sourcePath"),bundle=await exactReviewPackage(options,context.pool,id,packageId,version);
  const sourceItems=bundle.items.filter(item=>item.sourcePath===sourcePath);
  if(sourceItems.length===0)throw new HttpError(404,"Review source not found in this exact package version.");
  const now=new Date().toISOString().replace(/\.\d{3}Z$/u,"Z"),states=await reviewStates(options,context.pool,id,bundle.items,now),keys=new Set(sourceItems.map(item=>reviewIdentityKey(readingReviewIdentity(item)))),due=listDueReviewStates(states,now).filter(state=>keys.has(reviewIdentityKey(state))),dueKeys=new Set(due.map(state=>reviewIdentityKey(state))),dueItems=sourceItems.filter(item=>dueKeys.has(reviewIdentityKey(readingReviewIdentity(item))));
  const requestedSession=url.searchParams.get("session")?.trim(),owner=reviewSessionOwner(id);
  let sessionId=requestedSession,session=requestedSession?context.reviewSessions.get(requestedSession):undefined;
  if(requestedSession&&(!session||session.owner!==owner||session.packageId!==packageId||session.packageVersion!==version||session.sourcePath!==sourcePath))throw new HttpError(409,"This Review session is unavailable or belongs to another exact source.");
  if(!session&&dueItems.length>0){
    sessionId=randomUUID();
    session={owner,packageId,packageVersion:version,sourcePath,itemIds:orderReadingReviewItemsForSession(dueItems,{random:options.reviewRandom??Math.random}).map(item=>item.item.id),touchedAt:Date.now()};
    context.reviewSessions.set(sessionId,session);pruneReviewSessions(context.reviewSessions);
  }
  if(session){session.itemIds=session.itemIds.filter(itemId=>dueItems.some(item=>item.item.id===itemId));session.touchedAt=Date.now()}
  const item=session?.itemIds.length?sourceItems.find(candidate=>candidate.item.id===session!.itemIds[0]):undefined,state=item===undefined?undefined:states.find(candidate=>reviewIdentityKey(candidate)===reviewIdentityKey(readingReviewIdentity(item)));
  if(state!==undefined&&!item)throw new HttpError(409,"A due Review card is no longer available. Refresh the source.");
  json(res,200,{packageId,packageVersion:version,stablePackageId:reviewStablePackageId(bundle.record),sourcePath,scope:bundle.scope,total:sourceItems.length,due:session?.itemIds.length??0,complete:item===undefined,...(sessionId?{sessionId}:{}),card:item&&state?reviewCard(item,state,await requestLocale(context.pool,id,options)):undefined});
}

async function revealReview(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){
  const body=await bodyJson(req),packageId=required(body.packageId),version=required(body.packageVersion),sourcePath=required(body.sourcePath),itemId=required(body.itemId),bundle=await exactReviewPackage(options,pool,id,packageId,version),item=reviewItemFor(bundle,sourcePath,itemId),now=new Date().toISOString().replace(/\.\d{3}Z$/u,"Z"),states=await reviewStates(options,pool,id,bundle.items,now);
  if(!item){if(retiredStateFor(bundle,sourcePath,itemId,states))throw new HttpError(409,"This Review card is retired or inactive.");throw new HttpError(404,"Review card not found in this exact package version and source.")}
  const state=activeStateFor(item,states);
  if(!state||state.retiredAt!==undefined||state.status==="suspended")throw new HttpError(409,"This Review card is retired or inactive.");
  const rendered=renderMemorizationExercise({packageId:item.packageId,packageVersion:item.packageVersion,itemId:item.item.id,item:item.item,sourceLocale:await requestLocale(pool,id,options)});
  json(res,200,{itemId,answerLanguage:rendered.answerLanguage,answerLines:rendered.answerLines,exampleLines:learnerReviewExamples(item,rendered.exampleLines),sourceAvailable:item.sourceExists!==false});
}

async function answer(req:IncomingMessage,res:ServerResponse,options:WebServerOptions,context:WebContext,id:true|DatabaseSession){
  const body=await bodyJson(req),rating=String(body.rating) as ReviewRating;if(!["again","hard","good","easy"].includes(rating))throw new HttpError(400,"Invalid rating.");
  const expectedReviewCount=body.expectedReviewCount;if(!Number.isInteger(expectedReviewCount)||Number(expectedReviewCount)<0)throw new HttpError(400,"expectedReviewCount must be a non-negative integer.");
  const packageId=required(body.packageId),version=required(body.packageVersion),sourcePath=required(body.sourcePath),itemId=required(body.itemId),sessionId=typeof body.sessionId==="string"&&body.sessionId.trim()?body.sessionId.trim():undefined;
  try{return await exclusivePackageMutation(context,async()=>{
    const session=sessionId===undefined?undefined:context.reviewSessions.get(sessionId);if(sessionId!==undefined&&(!session||session.owner!==reviewSessionOwner(id)||session.packageId!==packageId||session.packageVersion!==version||session.sourcePath!==sourcePath||session.itemIds[0]!==itemId))throw new HttpError(409,"This Review session changed before the rating was accepted.");
    const bundle=await exactReviewPackage(options,context.pool,id,packageId,version),item=reviewItemFor(bundle,sourcePath,itemId),at=new Date().toISOString().replace(/\.\d{3}Z$/u,"Z"),states=await reviewStates(options,context.pool,id,bundle.items,at);if(!item){if(retiredStateFor(bundle,sourcePath,itemId,states))throw new HttpError(409,"This Review card is retired or inactive.");throw new HttpError(404,"Review card not found in this exact package version and source.")}const state=activeStateFor(item,states);if(!state||state.retiredAt!==undefined||state.status==="suspended")throw new HttpError(409,"This Review card is retired or inactive.");if(state.reviewCount!==expectedReviewCount)throw new HttpError(409,"Review state changed before this rating was accepted.");if(state.nextReviewAt>at)throw new HttpError(409,"This Review card is no longer due.");
    const identity=readingReviewIdentity(item),outcome=context.pool?await recordUserReview(context.pool,(id as DatabaseSession).id,identity,rating,at,Number(expectedReviewCount)):await recordStoredReviewOutcome({progressDir:progressDir(options),...identity,rating,reviewedAt:at});
    if(session)session.itemIds.shift();
    return json(res,200,outcome);
  })}catch(error){if(error instanceof StaleReviewStateError)throw new HttpError(409,error.message);throw error}
}
function reviewSessionOwner(id:true|DatabaseSession){return id===true?"local":id.id}
function pruneReviewSessions(sessions:Map<string,WebReviewSession>){const expiry=Date.now()-6*60*60*1000;for(const[key,session]of sessions)if(session.touchedAt<expiry)sessions.delete(key);while(sessions.size>10000)sessions.delete(sessions.keys().next().value!)}
function learnerReviewExamples(item:ReadingReviewItem,structuredExamples:readonly string[]):readonly string[]{
  const literalEvidence=item.item.schemaVersion===2?[item.item.provenance.evidence]:[];
  const unique:string[]=[];
  for(const candidate of [...structuredExamples,...literalEvidence]){
    const value=candidate.trim();
    if(!value||internalReviewProse(value)||unique.includes(value))continue;
    unique.push(value);if(unique.length===3)break;
  }
  return unique;
}
function internalReviewProse(value:string){return /\bprompts?\s+(?:the\s+learner\s+)?(?:to\s+)?recall\b|^this\s+(?:card|item)\s+(?:prompts|tests)\b|(?:^|[\\/])(?:content|review-decks|units)[\\/]|\.tsv\b|\t/iu.test(value)}
async function allowedPackage(pool:Pool,userId:string,packageId:string,packageVersion:string){return userHasSelectedPackage(pool,userId,packageId,packageVersion)}
async function reviewItems(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const packageId=query(url,"packageId"),version=query(url,"version");if(pool&&!await allowedPackage(pool,(id as DatabaseSession).id,packageId,version))throw new HttpError(403,"This package version is not selected for your account.");const record=(await listInstalledContentPackages(options.dataDir)).find(item=>item.packageId===packageId&&item.packageVersion===version);if(!record||!isReviewPackage(record))return json(res,200,{items:[]});const bundle=await exactReviewPackage(options,pool,id,packageId,version);json(res,200,{items:bundle.items})}
async function content(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const selected=url.searchParams.get("packageId"),allowed=pool?new Set((await selectedPackages(pool,(id as DatabaseSession).id)).map(x=>x.package_id+"@"+x.package_version)):undefined;if(selected){const version=query(url,"version");if(allowed&&!allowed.has(selected+"@"+version))throw new HttpError(403,"This package version is not selected for your account.");const locale=pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage,all=await listInstalledReadablePackages(options.dataDir,locale),packages=allowed?all.filter(x=>allowed.has(x.packageId+"@"+x.packageVersion)):all;return json(res,200,{packages,entries:await listReadableContentEntries(selected,options.dataDir,version)})}const locale=pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage,all=await listInstalledReadablePackages(options.dataDir,locale),packages=allowed?all.filter(x=>allowed.has(x.packageId+"@"+x.packageVersion)):all;json(res,200,{packages,entries:[]})}
async function contentEntry(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const packageId=query(url,"packageId"),version=query(url,"version");if(pool&&!await allowedPackage(pool,(id as DatabaseSession).id,packageId,version))throw new HttpError(403,"This package version is not selected for your account.");const locale=pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage;json(res,200,await readInstalledContentEntry({dataDir:options.dataDir,packageId,packageVersion:version,path:query(url,"path"),locale}))}

async function curricula(res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const locale=await requestLocale(pool,id,options),allRecords=await listInstalledContentPackages(options.dataDir),records=allRecords.filter(x=>x.contentType==="language-curriculum"),selections=pool?await selectedPackages(pool,(id as DatabaseSession).id):undefined,allowed=selections?new Set(selections.map(x=>x.package_id+"@"+x.package_version)):undefined,selected=allowed?records.filter(x=>allowed.has(x.packageId+"@"+x.packageVersion)):records,installedKeys=new Set(allRecords.map(x=>x.packageId+"@"+x.packageVersion)),views=[],unavailable:{packageId:string;packageVersion:string;reason:"not-installed"|"incompatible-legacy"|"corrupt"|"unreadable-current"}[]=(selections??[]).filter(x=>!installedKeys.has(x.package_id+"@"+x.package_version)).map(x=>({packageId:x.package_id,packageVersion:x.package_version,reason:"not-installed"}));for(const record of selected){try{views.push(await getInstalledLanguageCurriculum(record.packageId,record.packageVersion,locale,options.dataDir))}catch(error){const reason=error instanceof InstalledCurriculumUnavailableError?error.reason:"unreadable-current";unavailable.push({packageId:record.packageId,packageVersion:record.packageVersion,reason});console.error("Unable to derive installed curriculum",record.packageId,record.packageVersion,reason)}}json(res,200,{requestedSourceLocale:locale,curricula:views,unavailable})}
async function curriculum(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){const packageId=query(url,"packageId"),version=query(url,"version");await requireAllowed(pool,id,packageId,version);try{json(res,200,await getInstalledLanguageCurriculum(packageId,version,await requestLocale(pool,id,options),options.dataDir))}catch(error){throw classifyContentError(error)}}
async function curriculumChapter(url:URL,res:ServerResponse,options:WebServerOptions,pool:Pool|undefined,id:true|DatabaseSession){
  const packageId=query(url,"packageId"),version=query(url,"version"),chapterId=query(url,"chapter");
  await requireAllowed(pool,id,packageId,version);
  try{
    const locale=await requestLocale(pool,id,options);
    const display={
      mode:curriculumDisplayMode(url.searchParams.get("mode")),
      translations:booleanQuery(url,"translations"),
      characters:booleanQuery(url,"characters"),
      breakdown:booleanQuery(url,"breakdown")
    };
    const result=await readInstalledLanguageCurriculumChapter({dataDir:options.dataDir,packageId,packageVersion:version,chapterId,requestedSourceLocale:locale});
    const text=await projectWebCurriculumChapter(result.text,result.chapter.path,{...display,packageId,packageVersion:version,locale,dataDir:options.dataDir});
    json(res,200,{...result,text,display});
  }catch(error){throw classifyContentError(error)}
}
async function requireAllowed(pool:Pool|undefined,id:true|DatabaseSession,packageId:string,version:string){if(pool&&!await allowedPackage(pool,(id as DatabaseSession).id,packageId,version))throw new HttpError(403,"This package version is not selected for your account.")}
async function requestLocale(pool:Pool|undefined,id:true|DatabaseSession,options:WebServerOptions){return canonicalWebLocale(pool?(await userSettings(pool,(id as DatabaseSession).id)).locale:(await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage)}
function classifyContentError(error:unknown){const message=error instanceof Error?error.message:"";if(/not found|not a language curriculum/iu.test(message))return new HttpError(404,"The requested curriculum or chapter is unavailable.");if(/corrupt|unreadable|invalid/iu.test(message))return new HttpError(500,"Curriculum content could not be read.");return error}

interface WebChapterProjectionOptions {
  readonly packageId:string;
  readonly packageVersion:string;
  readonly locale:string;
  readonly dataDir?:string;
  readonly mode:CurriculumDisplayMode;
  readonly translations:boolean;
  readonly characters:boolean;
  readonly breakdown:boolean;
}

async function projectWebCurriculumChapter(raw:string,chapterPath:string,options:WebChapterProjectionOptions):Promise<string>{
  const entries=await listReadableContentEntries(options.packageId,options.dataDir,options.packageVersion,options.locale);
  const paths=new Set(entries.map(entry=>entry.path));
  const role=curriculumContentRole(chapterPath);
  let markdown=raw;

  if(options.mode==="developer"&&role==="grammar-easy"){
    const expertPath=chapterPath.replace(/-grammar-easy\//u,"-grammar-hard/");
    if(paths.has(expertPath)){
      try{
        const expert=await readInstalledContentEntry({dataDir:options.dataDir,packageId:options.packageId,packageVersion:options.packageVersion,path:expertPath,locale:options.locale});
        markdown=combineDeveloperGrammarMarkdown(raw,expert.text);
      }catch{/* A damaged optional pair must not hide the selected exact chapter. */}
    }
  }

  if(role==="reading"){
    const supportPath=chapterPath.replace(/chapter\.md$/u,"reading-support.json");
    const support=paths.has(supportPath)?await readOptionalSupport(supportPath,options):undefined;
    let translation:StructuredReadingTranslation|undefined;
    if(options.translations){
      const translationPath=chapterPath.replace(/chapter\.md$/u,"reading-translation.en.json");
      translation=paths.has(translationPath)?await readOptionalTranslation(translationPath,options):undefined;
      if(translation!==undefined){
        const legacy=insertExistingWebOverlayTranslation(markdown,translation);
        if(legacy!==markdown){markdown=legacy;translation=undefined}
      }
    }
    return projectReadingChapterMarkdown(markdown,{mode:options.mode,translationsEnabled:options.translations,charactersEnabled:options.characters,breakdownEnabled:options.breakdown,support,translation});
  }

  return projectCurriculumMarkdown(markdown,options.mode,{contentRole:options.mode==="developer"&&role==="grammar-easy"?"reading":role,translationsEnabled:options.translations});
}

async function readOptionalSupport(path:string,options:WebChapterProjectionOptions):Promise<ReadingSupport|undefined>{
  try{
    const result=await readInstalledContentEntry({dataDir:options.dataDir,packageId:options.packageId,packageVersion:options.packageVersion,path,locale:options.locale});
    return parseSharedReadingSupport(result.text);
  }catch{return undefined}
}

async function readOptionalTranslation(path:string,options:WebChapterProjectionOptions):Promise<StructuredReadingTranslation|undefined>{
  try{
    const result=await readInstalledContentEntry({dataDir:options.dataDir,packageId:options.packageId,packageVersion:options.packageVersion,path,locale:options.locale});
    return parseSharedStructuredReadingTranslation(result.text);
  }catch{return undefined}
}

// Preserve the established Web overlay projection for the legacy heading
// shape that the CLI intentionally does not reinterpret in this Reader task.
function insertExistingWebOverlayTranslation(markdown:string,translation:StructuredReadingTranslation):string{
  const lines=markdown.replace(/\r\n?/gu,"\n").split("\n");
  const escaped=translation.sourceSection.replace(/[.*+?^${}()|[\]\\]/gu,"\\$&");
  const start=lines.findIndex(line=>new RegExp(`^##\\s+${escaped}\\s*$`,"u").test(line.trim()));
  if(start<0)return markdown;
  const end=lines.findIndex((line,index)=>index>start&&/^#{1,2}\s+/u.test(line.trim()));
  if(end<0||lines.slice(start+1,end).some(line=>/^###\s+/u.test(line.trim())))return markdown;
  const body=translation.readingType==="dialogue"
    ?(translation.turns??[]).map(turn=>`${turn.speaker}: ${turn.text}`)
    :translation.sentences??translation.paragraphs??[];
  return[...lines.slice(0,end),"### Natural English Translation","",...body,"",...lines.slice(end)].join("\n");
}

function curriculumContentRole(path:string):CurriculumContentRole{
  if(/-grammar-easy\//u.test(path))return"grammar-easy";
  if(/-grammar-hard\//u.test(path))return"grammar-hard";
  return"reading";
}

function curriculumDisplayMode(value:string|null):CurriculumDisplayMode{
  if(value===null||value===""||value==="normal")return"normal";
  if(value==="expert"||value==="developer")return value;
  throw new HttpError(400,"Unsupported curriculum display mode.");
}

function booleanQuery(url:URL,name:string):boolean{
  const value=url.searchParams.get(name);
  if(value===null||value===""||value==="false")return false;
  if(value==="true")return true;
  throw new HttpError(400,`${name} must be true or false.`);
}

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
async function bodyJson(req: IncomingMessage): Promise<Record<string, unknown>> { const chunks: Buffer[] = [];let size=0;for await (const chunk of req){const value=Buffer.from(chunk);size+=value.length;if(size>64*1024)throw new HttpError(400,"Request body too large.");chunks.push(value)}return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
function required(value: unknown): string { if (typeof value !== "string" || !value.trim()) throw new HttpError(400,"Missing required value."); return value; }
function query(url:URL,name:string){const value=url.searchParams.get(name)?.trim();if(!value)throw new HttpError(400,`${name} is required.`);return value}
function canonicalWebLocale(locale:string){return locale==="zh-Hant-TW"||locale==="zh-TW"?"zh-TW":locale==="en-US"||locale==="en"?"en":locale}
function securityHeaders(headers: Record<string, string>) { return { ...headers, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=()", "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'" }; }
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, securityHeaders({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })); res.end(JSON.stringify(value)); }
function isDatabaseError(error:unknown){return !!error&&typeof error==="object"&&("code" in error||"severity" in error)}
function validatedSessionTtl(value:number){if(!Number.isInteger(value)||value<300||value>2592000)throw new Error("WHACKSMACKER_SESSION_TTL must be 300-2592000 seconds.");return value}

export function parseWebOptions(args: readonly string[], env: Record<string, string | undefined> = process.env): WebServerOptions | "help" {
  const result: { host?: string; port?: number; dataDir?: string; cataloguePath?: string; password?: string; databaseUrl?:string;publicUrl?:string;secureCookies?:boolean;sessionTtl?:number;trustProxy?:boolean } = { password: env.DATABASE_URL?undefined:env.WHACKSMACKER_WEB_PASSWORD };
  if(env.DATABASE_URL)result.databaseUrl=env.DATABASE_URL;if(env.WHACKSMACKER_PUBLIC_URL)result.publicUrl=env.WHACKSMACKER_PUBLIC_URL;if(env.WHACKSMACKER_SECURE_COOKIES==="true")result.secureCookies=true;if(env.WHACKSMACKER_SESSION_TTL)result.sessionTtl=validatedSessionTtl(Number(env.WHACKSMACKER_SESSION_TTL));if(env.WHACKSMACKER_TRUST_PROXY==="true")result.trustProxy=true;
  for (let i = 0; i < args.length; i++) { const arg = args[i]; if (arg === "-h" || arg === "--help") return "help"; const value = args[++i]; if (!value) throw new Error(`${arg} requires a value.`); if (arg === "--host") result.host = value; else if (arg === "--port") { result.port = Number(value); if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535) throw new Error("--port must be an integer from 1 to 65535."); } else if (arg === "--data-dir") result.dataDir = value; else if (arg === "--catalogue") result.cataloguePath = value; else if (arg === "--password") result.password = value; else throw new Error(`Unknown web option: ${arg}`); }
  return result;
}
