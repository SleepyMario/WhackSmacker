import { test, expect } from "@playwright/test";
import { alphaPackage, baseUrl, captureDiagnostics, chapter, deepLink, login, openChapter, resetUsers, revokeUserA } from "./helpers.mjs";

let diagnostics;
test.beforeEach(async ({ page }) => { await resetUsers(); diagnostics = captureDiagnostics(page); });
test.afterEach(async () => { expect(diagnostics.issues, diagnostics.issues.join("\n")).toEqual([]); });

test("authentication preserves a local deep link, reloads a session, rejects an external return, and logs out", async ({ page }) => {
  const target = deepLink({ chapterId: chapter(10) });
  await page.goto(`${baseUrl()}${target}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${encodeURIComponent(target).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));
  await login(page, "A", page.url().slice(baseUrl().length));
  await expect(page.locator("#chapter-title")).toContainText("Chapter 10");
  await page.reload();
  await expect(page.locator("#chapter-title")).toContainText("Chapter 10");
  await expect(page).toHaveURL(/version=1\.0\.0/u);
  await page.locator("#logout").click();
  await expect(page).toHaveURL(/\/login/u);

  await login(page, "B", "/login?returnTo=https%3A%2F%2Fevil.example%2Fstolen");
  expect(new URL(page.url()).origin).toBe(baseUrl());
  expect(new URL(page.url()).pathname).toBe("/app");
});

test("chapter discovery, safe rendering, exact-version URLs, navigation, and curriculum changes", async ({ page }) => {
  await login(page, "A", deepLink());
  const labels = await page.locator("#chapters button").allTextContents();
  expect(labels).toEqual(["Chapter 9 — Foundations", "Chapter 10 — Safe reading", "Chapter 11 — Een zeer lange meertalige titel 第十一章 한국어 제목"]);
  await expect(page.locator("#chapters")).not.toContainText(/summary|teacher|metadata|tsv/iu);
  await expect(page.locator("#previous")).toBeDisabled();
  await expect(page.locator("#next")).toBeEnabled();

  await page.locator("#next").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#chapter-title")).toContainText("Chapter 10");
  await expect(page).toHaveURL(/version=1\.0\.0.*chapter=units%2Fcore%2Fchapter-010-ten/u);
  await expect(page.locator("#chapter-content img")).toHaveCount(0);
  await expect(page.locator("#chapter-content a")).toHaveCount(0);
  await expect(page.locator("#chapter-content")).toContainText("<img src=x onerror=alert(1)> stays text");
  await expect(page.locator("#chapter-content table")).toBeVisible();

  await openChapter(page, "Chapter 11");
  await expect(page.locator("#next")).toBeDisabled();
  const copied = page.url();
  await page.goto(copied);
  await expect(page.locator("#chapter-title")).toContainText("Chapter 11");
  await expect(page).toHaveURL(/version=1\.0\.0/u);

  await page.locator("#curriculum").focus();
  await page.locator("#curriculum").selectOption(alphaPackage().replace("alpha", "beta"));
  await expect(page.locator("#version")).toHaveValue("2.0.0");
  await expect(page.locator("#reader")).toBeHidden();
  await expect(page).not.toHaveURL(/chapter=/u);
  await expect(page.locator("#chapters")).not.toContainText("Chapter 11");

  await page.goto(`${baseUrl()}${deepLink({ version: "9.9.9" })}`);
  await expect(page.locator("#status")).toContainText(/unavailable|not authorized/iu);
  await expect(page.locator("#controls")).toBeHidden();
});

test("source locale and per-chapter fallback persist without cross-user interference", async ({ browser, page }) => {
  await login(page, "A", deepLink({ chapterId: chapter(10) }));
  const chinese = page.locator('input[name="source-locale"][value="zh-TW"]');
  await chinese.focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/locale=zh-TW/u);
  await openChapter(page, "Chapter 10");
  await expect(page.locator("#overlay")).toContainText(/Traditional Chinese.*active/iu);
  await expect(page.locator("#chapter-content")).toContainText("繁體中文第十章");
  await openChapter(page, "Chapter 11");
  await expect(page.locator("#overlay")).toContainText(/requested Traditional Chinese.*Showing English fallback/iu);
  await expect(page.locator("#chapter-content")).toContainText("English fallback paragraph");
  await page.reload();
  await expect(chinese).toBeChecked();
  await expect(page).toHaveURL(/locale=zh-TW/u);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const otherDiagnostics = captureDiagnostics(pageB);
  await login(pageB, "B", deepLink({ locale: "en" }));
  await expect(pageB.locator('input[value="en"]')).toBeChecked();
  await expect(pageB.locator("#overlay")).toContainText(/English source overlay is active/iu);
  await page.reload();
  await expect(chinese).toBeChecked();
  expect(otherDiagnostics.issues).toEqual([]);
  await contextB.close();
});

test("history and generation tracking prevent stale chapter replacement", async ({ page }) => {
  await login(page, "A", deepLink());
  await openChapter(page, "Chapter 10");
  await openChapter(page, "Chapter 11");
  await page.goBack();
  await expect(page.locator("#chapter-title")).toContainText("Chapter 10");
  await page.goForward();
  await expect(page.locator("#chapter-title")).toContainText("Chapter 11");

  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  let intercepted;
  const seen = new Promise(resolve => { intercepted = resolve; });
  diagnostics.expectRequestFailure("chapter-010-ten");
  await page.route("**/api/curriculum/chapter?**", async route => {
    if (route.request().url().includes("chapter-010-ten")) {
      intercepted();
      await delayed;
      await route.continue().catch(() => undefined);
    } else await route.continue();
  });
  const pending = page.locator("#chapters button", { hasText: "Chapter 10" }).click();
  await seen;
  await page.goto(`${baseUrl()}${deepLink({ chapterId: chapter(11) })}`);
  await expect(page.locator("#chapter-title")).toContainText("Chapter 11");
  release();
  await pending.catch(() => undefined);
  await page.waitForTimeout(150);
  await expect(page.locator("#chapter-title")).toContainText("Chapter 11");
});

test("revoked API session returns cleanly to login", async ({ page }) => {
  await login(page, "A", deepLink());
  diagnostics.allowExpectedNetworkErrors();
  diagnostics.expectRequestFailure("/api/settings");
  await revokeUserA();
  await page.locator('input[name="source-locale"][value="zh-TW"]').click();
  await expect(page).toHaveURL(/\/login\?returnTo=/u);
  await expect(page.locator("#login-form")).toBeVisible();
});

test("classified transport and server failures terminate loading and retain usable controls", async ({ page }) => {
  await login(page, "A", deepLink());
  diagnostics.allowExpectedNetworkErrors();
  const button = () => page.locator("#chapters button", { hasText: "Chapter 10" });
  const cases = [
    { status: 403, body: { error: "secret filesystem /private/package" }, expected: /not authorized/iu },
    { status: 404, body: { error: "gone" }, expected: /no longer available/iu },
    { status: 500, body: { error: "SQL stack /private/package" }, expected: /could not read/iu },
    { status: 200, raw: "not-json", expected: /invalid response/iu }
  ];
  for (const item of cases) {
    await page.route("**/api/curriculum/chapter?**", route => route.fulfill({ status: item.status, contentType: "application/json", body: item.raw ?? JSON.stringify(item.body) }), { times: 1 });
    await button().click();
    await expect(page.locator("#status")).toContainText(item.expected);
    await expect(button()).toBeEnabled();
    await expect(page.locator("body")).not.toContainText(/\/private\/package|SQL stack/iu);
  }
  diagnostics.expectRequestFailure("/api/curriculum/chapter");
  await page.route("**/api/curriculum/chapter?**", route => route.abort("connectionrefused"), { times: 1 });
  await button().click();
  await expect(page.locator("#status")).toContainText(/network connection was lost/iu);
  await expect(button()).toBeEnabled();
  await expect(page.locator("#status")).toHaveAttribute("role", "status");
  await expect(page.locator("#status")).toHaveAttribute("aria-live", "polite");
});
