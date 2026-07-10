import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  installContentPackage,
  listAvailableContentPackages,
  listInstalledContentPackages,
  listInstalledReadablePackages,
  listReadableContentEntries,
  readInstalledContentEntry,
  listReadingReviewItems,
  listReadingReviewSources,
  loadReviewProgressStore,
  recordReadingReviewAnswer,
  removeContentPackage,
  removeReadingReviewProgressForPackage,
  syncReadingReviewItems,
  defaultReviewProgressDirectoryForContentDataDirectory,
  reviewIdentityKey,
  type ReviewRating
} from "../../packages/core";
import { defaultSettingsDirectoryForContentDataDirectory, loadSourceLanguageSettings, saveSourceLanguage } from "../../src/settings/source-language";
import { isSourceLocale, type SourceLocale } from "../../src/i18n";

export interface WebServerOptions { readonly host?: string; readonly port?: number; readonly dataDir?: string; readonly cataloguePath?: string; readonly password?: string; }
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
  const sessions = new Set<string>();
  const server = createServer((request, response) => void handle(request, response, options, sessions));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => { server.off("error", reject); resolve(); });
  });
  return server;
}

async function handle(request: IncomingMessage, response: ServerResponse, options: WebServerOptions, sessions: Set<string>): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/api/health") return json(response, 200, { ok: true, service: "whacksmacker-web" });
    if (url.pathname === "/api/login" && request.method === "POST") return login(request, response, options, sessions);
    if (url.pathname === "/api/logout" && request.method === "POST") return logout(request, response, sessions);
    const publicFiles: Record<string, [string, string]> = {
      "/": ["landing.html", "text/html; charset=utf-8"],
      "/login": ["login.html", "text/html; charset=utf-8"],
      "/landing.css": ["landing.css", "text/css; charset=utf-8"],
      "/login.js": ["login.js", "text/javascript; charset=utf-8"],
      "/assets/whacksmacker-logo.png": ["assets/whacksmacker-logo.png", "image/png"]
    };
    const publicFile = publicFiles[url.pathname];
    if (publicFile) return staticFile(request, response, publicFile);
    if (!authorized(request, options.password, sessions)) { response.setHeader("WWW-Authenticate", 'Basic realm="WhackSmacker"'); return json(response, 401, { error: "Authentication required." }); }
    if (url.pathname === "/api/state" && request.method === "GET") return json(response, 200, await state(options));
    if (url.pathname === "/api/settings" && request.method === "PUT") return updateSettings(request, response, options);
    if (url.pathname === "/api/packages/install" && request.method === "POST") return install(request, response, options);
    if (url.pathname === "/api/packages/remove" && request.method === "POST") return remove(request, response, options);
    if (url.pathname === "/api/review/answer" && request.method === "POST") return answer(request, response, options);
    if (url.pathname === "/api/review-items" && request.method === "GET") return reviewItems(url, response, options);
    if (url.pathname === "/api/content" && request.method === "GET") return content(url, response, options);
    if (url.pathname === "/api/content/entry" && request.method === "GET") return contentEntry(url, response, options);
    const files: Record<string, [string, string]> = { "/app": ["index.html", "text/html; charset=utf-8"], "/app.js": ["app.js", "text/javascript; charset=utf-8"], "/styles.css": ["styles.css", "text/css; charset=utf-8"] };
    const file = files[url.pathname];
    if (file) return staticFile(request, response, file);
    json(response, 404, { error: "Not found." });
  } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
}

async function state(options: WebServerOptions) {
  const locale = (await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage;
  const installed = await listInstalledContentPackages(options.dataDir);
  const available = options.cataloguePath ? await listAvailableContentPackages(options.cataloguePath) : [];
  const now = new Date().toISOString();
  await syncReadingReviewItems({ dataDir: options.dataDir, now, sourceLocale: locale });
  const items = await listReadingReviewItems({ dataDir: options.dataDir, sourceLocale: locale });
  const progress = await loadReviewProgressStore(progressDir(options));
  const progressByKey = new Map(progress.items.map(item => [reviewIdentityKey(item), item]));
  const decks = (await listReadingReviewSources({ dataDir: options.dataDir, sourceLocale: locale })).map(source => {
    const deckItems = items.filter(item => item.packageId === source.packageId && item.packageVersion === source.packageVersion && item.sourcePath === source.sourcePath);
    const states = deckItems.map(item => progressByKey.get(reviewIdentityKey({ packageId: item.packageId, packageVersion: item.packageVersion, sourcePath: item.sourcePath, itemId: item.item.id })));
    const reviewed = states.filter(item => (item?.reviewCount ?? 0) > 0).length;
    const due = states.filter(item => item !== undefined && item.nextReviewAt <= now).length;
    const status = reviewed === 0 ? "not_started" : reviewed === deckItems.length && due === 0 ? "finished" : due > 0 ? "has_cards_to_review" : "no_cards_to_review";
    return { ...source, title: source.title ?? source.sourcePath.split("/").at(-2) ?? source.sourcePath, reviewed, due, status };
  });
  return { locale, installed, available, decks, review: { total: progress.items.length, due: progress.items.filter(item => item.nextReviewAt <= now).length, reviewed: progress.items.filter(item => item.reviewCount > 0).length } };
}

async function updateSettings(req: IncomingMessage, res: ServerResponse, options: WebServerOptions) { const body = await bodyJson(req); if (!isSourceLocale(body.locale)) throw new Error("Unsupported source language."); await saveSourceLanguage(body.locale, settingsDir(options)); json(res, 200, { locale: body.locale }); }
async function install(req: IncomingMessage, res: ServerResponse, options: WebServerOptions) { if (!options.cataloguePath) throw new Error("Start the web GUI with --catalogue to install packages."); const body = await bodyJson(req); const result = await installContentPackage({ cataloguePath: options.cataloguePath, packageId: required(body.packageId), dataDir: options.dataDir }); json(res, 200, result); }
async function remove(req: IncomingMessage, res: ServerResponse, options: WebServerOptions) { const body = await bodyJson(req); const packageId = required(body.packageId); const packageVersion = required(body.packageVersion); const result = await removeContentPackage({ dataDir: options.dataDir, packageId, packageVersion }); if (body.keepProgress !== true) await removeReadingReviewProgressForPackage({ dataDir: options.dataDir, packageId, packageVersion, removedAt: new Date().toISOString() }); json(res, 200, result); }
async function answer(req: IncomingMessage, res: ServerResponse, options: WebServerOptions) { const body = await bodyJson(req); const ratings = ["again", "hard", "good", "easy"]; if (!ratings.includes(String(body.rating))) throw new Error("Invalid rating."); const result = await recordReadingReviewAnswer({ dataDir: options.dataDir, packageId: required(body.packageId), packageVersion: required(body.packageVersion), sourcePath: required(body.sourcePath), itemId: required(body.itemId), rating: body.rating as ReviewRating, reviewedAt: new Date().toISOString() }); json(res, 200, result); }
async function reviewItems(url: URL, res: ServerResponse, options: WebServerOptions) { const locale = (await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage; const items = await listReadingReviewItems({ dataDir: options.dataDir, packageId: required(url.searchParams.get("packageId")), sourceLocale: locale }); json(res, 200, { items }); }
async function content(url: URL, res: ServerResponse, options: WebServerOptions) { const locale = (await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage; const packages = await listInstalledReadablePackages(options.dataDir, locale); const selected = url.searchParams.get("packageId"); const entries = selected ? await listReadableContentEntries(selected, options.dataDir, url.searchParams.get("version") ?? undefined) : []; json(res, 200, { packages, entries }); }
async function contentEntry(url: URL, res: ServerResponse, options: WebServerOptions) { const locale = (await loadSourceLanguageSettings(settingsDir(options))).sourceLanguage; const result = await readInstalledContentEntry({ dataDir: options.dataDir, packageId: required(url.searchParams.get("packageId")), packageVersion: url.searchParams.get("version") ?? undefined, path: required(url.searchParams.get("path")), locale }); json(res, 200, result); }

function settingsDir(options: WebServerOptions) { return options.dataDir ? defaultSettingsDirectoryForContentDataDirectory(options.dataDir) : undefined; }
function progressDir(options: WebServerOptions) { return options.dataDir ? defaultReviewProgressDirectoryForContentDataDirectory(options.dataDir) : undefined; }
function authorized(req: IncomingMessage, password: string | undefined, sessions: ReadonlySet<string>) { if (!password) return true; const session = cookie(req, "wsm_session"); if (session && sessions.has(session)) return true; const value = req.headers.authorization; if (!value?.startsWith("Basic ")) return false; return Buffer.from(value.slice(6), "base64").toString("utf8").split(":").slice(1).join(":") === password; }
async function login(req: IncomingMessage, res: ServerResponse, options: WebServerOptions, sessions: Set<string>) { if (!options.password) { res.setHeader("Set-Cookie", "wsm_session=local; Path=/; HttpOnly; SameSite=Strict"); return json(res, 200, { ok: true, authenticationRequired: false }); } const body = await bodyJson(req); if (body.password !== options.password) return json(res, 401, { error: "Incorrect password." }); const token = randomUUID(); sessions.add(token); res.setHeader("Set-Cookie", `wsm_session=${token}; Path=/; HttpOnly; SameSite=Strict`); json(res, 200, { ok: true, authenticationRequired: true }); }
function logout(req: IncomingMessage, res: ServerResponse, sessions: Set<string>) { const session = cookie(req, "wsm_session"); if (session) sessions.delete(session); res.setHeader("Set-Cookie", "wsm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"); json(res, 200, { ok: true }); }
function cookie(req: IncomingMessage, name: string) { for (const part of (req.headers.cookie ?? "").split(";")) { const [key, ...value] = part.trim().split("="); if (key === name) return value.join("="); } return undefined; }
async function staticFile(req: IncomingMessage, res: ServerResponse, file: [string, string]) { const data = await readFile(join(assets, file[0])); res.writeHead(200, securityHeaders({ "Content-Type": file[1], "Content-Length": String(data.length), "Cache-Control": file[1] === "image/png" ? "public, max-age=86400" : "no-store" })); if (req.method !== "HEAD") res.end(data); else res.end(); }
async function bodyJson(req: IncomingMessage): Promise<Record<string, unknown>> { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); if (chunks.reduce((sum, chunk) => sum + chunk.length, 0) > 64 * 1024) throw new Error("Request body too large."); return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
function required(value: unknown): string { if (typeof value !== "string" || !value.trim()) throw new Error("Missing required value."); return value; }
function securityHeaders(headers: Record<string, string>) { return { ...headers, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'" }; }
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, securityHeaders({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })); res.end(JSON.stringify(value)); }

export function parseWebOptions(args: readonly string[], env: Record<string, string | undefined> = process.env): WebServerOptions | "help" {
  const result: { host?: string; port?: number; dataDir?: string; cataloguePath?: string; password?: string } = { password: env.WHACKSMACKER_WEB_PASSWORD };
  for (let i = 0; i < args.length; i++) { const arg = args[i]; if (arg === "-h" || arg === "--help") return "help"; const value = args[++i]; if (!value) throw new Error(`${arg} requires a value.`); if (arg === "--host") result.host = value; else if (arg === "--port") { result.port = Number(value); if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535) throw new Error("--port must be an integer from 1 to 65535."); } else if (arg === "--data-dir") result.dataDir = value; else if (arg === "--catalogue") result.cataloguePath = value; else if (arg === "--password") result.password = value; else throw new Error(`Unknown web option: ${arg}`); }
  return result;
}
