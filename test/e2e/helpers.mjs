import { expect } from "@playwright/test";
import pg from "pg";

export const baseUrl = () => required("WSM_E2E_BASE_URL");
export const alphaPackage = () => required("WSM_E2E_ALPHA_PACKAGE");
export const betaPackage = () => required("WSM_E2E_BETA_PACKAGE");
export const chapter = number => `units/core/chapter-${String(number).padStart(3, "0")}-${number === 9 ? "nine" : number === 10 ? "ten" : "eleven"}/chapter.md`;

export async function resetUsers() {
  const pool = new pg.Pool({ connectionString: required("WSM_E2E_DATABASE_URL") });
  try {
    await pool.query("UPDATE users SET enabled=true WHERE id=ANY($1::uuid[])", [[required("WSM_E2E_USER_A_ID"), required("WSM_E2E_USER_B_ID")]]);
    await pool.query("UPDATE user_settings SET source_locale='en' WHERE user_id=ANY($1::uuid[])", [[required("WSM_E2E_USER_A_ID"), required("WSM_E2E_USER_B_ID")]]);
    await pool.query("UPDATE sessions SET revoked_at=now() WHERE user_id=ANY($1::uuid[]) AND revoked_at IS NULL", [[required("WSM_E2E_USER_A_ID"), required("WSM_E2E_USER_B_ID")]]);
  } finally { await pool.end(); }
}

export async function revokeUserA() {
  const pool = new pg.Pool({ connectionString: required("WSM_E2E_DATABASE_URL") });
  try { await pool.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [required("WSM_E2E_USER_A_ID")]); }
  finally { await pool.end(); }
}

export async function login(page, user = "A", returnTo = "/app") {
  await page.goto(`${baseUrl()}${returnTo.startsWith("/login") ? returnTo : `/login?returnTo=${encodeURIComponent(returnTo)}`}`);
  await expect(page.locator("#username")).toBeFocused();
  await page.keyboard.type(required(`WSM_E2E_USER_${user}`));
  await page.keyboard.press("Tab");
  await page.keyboard.type(required("WSM_E2E_PASSWORD"));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app(?:\?|$)/u);
  await expect(page.locator("#controls")).toBeVisible();
  await expect(page.locator("#curriculum")).toBeEnabled();
  if (new URL(`${baseUrl()}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`).searchParams.has("chapter")) {
    await expect(page.locator("#reader")).toBeVisible();
    await expect(page.locator("#status")).toContainText("loaded");
  }
}

export function deepLink({ locale = "en", chapterId = chapter(9), packageId = alphaPackage(), version = "1.0.0" } = {}) {
  const params = new URLSearchParams({ package: packageId, version, locale, chapter: chapterId });
  return `/app?${params}`;
}

export function captureDiagnostics(page) {
  const issues = [];
  const expectedFailures = new Set();
  let allowNetworkErrors = false;
  page.on("console", message => {
    if (message.type() === "error" && !(allowNetworkErrors && /Failed to load resource/iu.test(message.text()))) issues.push(`console: ${message.text()}`);
  });
  page.on("pageerror", error => issues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", request => {
    if (![...expectedFailures].some(fragment => request.url().includes(fragment))) issues.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });
  return {
    issues,
    expectRequestFailure(fragment) { expectedFailures.add(fragment); },
    allowExpectedNetworkErrors() { allowNetworkErrors = true; }
  };
}

export async function openChapter(page, title) {
  const button = page.locator("#chapters button", { hasText: title });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#reader")).toBeFocused();
  await expect(page.locator("#status")).toContainText("loaded");
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} was not provided by the Playwright global setup.`);
  return value;
}
