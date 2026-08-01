import { test, expect } from "@playwright/test";
import { baseUrl, captureDiagnostics, login, resetUsers, userState } from "./helpers.mjs";

const reviewRoute = "/app?view=review";
let diagnostics;

test.beforeEach(async ({ page }) => { await resetUsers(); diagnostics = captureDiagnostics(page); });
test.afterEach(async () => { expect(diagnostics.issues, diagnostics.issues.join("\n")).toEqual([]); });

test("discovers authorized ordinary and specialized Review packages without exposing overlays", async ({ page }) => {
  await login(page, "A", reviewRoute);
  await expect(page.locator("#review-package")).toHaveValue(/\.reviews$/u);
  const options = await page.locator("#review-package option").allTextContents();
  expect(options).toEqual(["Portable Browser Review", "Portable Specialized Review"]);
  expect(options.join(" ")).not.toMatch(/source/iu);
  await expect(page.locator("#review-version")).toHaveValue("1.0.0");
  await expect(page.locator("#review-version option")).toHaveText(["1.0.0", "2.0.0"]);
  await expect(page.locator("#deck-list")).toContainText("Chapter 10 — Greetings");
  await expect(page.locator("#deck-list")).toContainText("2 cards");
  await expect(page.locator("#deck-list .due-badge")).toContainText("2 due");
  await expect(page.locator("#deck-list")).toContainText("Ordinary Review");

  await page.locator("#review-package").selectOption({ label: "Portable Specialized Review" });
  await expect(page.locator("#deck-list")).toContainText("Specialized Review");
  await expect(page.locator("#deck-list")).toContainText("Linguistics");
  await expect(page).toHaveURL(/reviewPackage=.*specialized-reviews.*reviewVersion=1\.0\.0/u);
});

test("exact Review package versions keep independent due state and are never silently substituted", async ({ page }) => {
  await login(page, "A", reviewRoute);
  await expect(page.locator("#review-version")).toHaveValue("1.0.0");
  await page.locator("#review-session").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".review-answer")).toBeVisible();
  await expect(page.locator("#review-session")).toHaveAttribute("aria-busy","false");
  await page.getByRole("button", { name: /Good/u }).click();
  await expect.poll(async()=>(await userState("A")).historyCount).toBe(1);
  const progress = (await userState("A")).progress.filter(item => item.package_id === process.env.WSM_E2E_ALPHA_PACKAGE && item.item_id === "stable-browser-card");
  expect(progress.map(item => [item.package_version, item.review_count])).toEqual([["1.0.0", 1], ["2.0.0", 0]]);
  await page.locator("#review-version").selectOption("2.0.0");
  await expect(page.locator(".review-prompt")).toContainText("Version two prompt");
  await expect(page).toHaveURL(/reviewVersion=2\.0\.0/u);
});

test("keyboard reveal and grades commit once, advance, and persist without accidental Enter grading", async ({ page }) => {
  await login(page, "A", reviewRoute);
  const before = await userState("A");
  await expect(page.locator(".review-card")).toBeVisible();
  await expect(page.locator(".review-answer")).toHaveCount(0);
  await expect(page.locator(".rating-button")).toHaveCount(0);
  await page.locator("#review-session").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".review-answer")).toBeVisible();
  await expect(page.locator(".review-answer")).toBeFocused();
  await expect(page.locator(".rating-button")).toHaveCount(4);
  await expect(page.locator(".review-answer")).toContainText("Examples");
  await expect(page.locator(".review-example")).toHaveText(["Goedemorgen, Alex!", "Goedemorgen allemaal."]);
  await expect(page.locator(".review-answer")).not.toContainText("A common morning greeting.");
  await expect(page.locator(".review-answer")).not.toContainText("Source example / evidence");
  await page.keyboard.press("Enter");
  expect((await userState("A")).historyCount).toBe(before.historyCount);
  await page.keyboard.press("3");
  await page.keyboard.press("3");
  await expect.poll(async () => (await userState("A")).historyCount).toBe(before.historyCount + 1);
  await expect(page.locator(".review-card")).toBeVisible();
  await page.reload();
  await expect(page.locator(".review-card")).toBeVisible();
  expect((await userState("A")).historyCount).toBe(before.historyCount + 1);
});

test("Space reveals once and repeated mouse rating cannot double-submit", async ({ page }) => {
  await login(page, "A", reviewRoute);
  await page.locator("#review-session").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect(page.locator(".review-answer")).toHaveCount(1);
  const before = (await userState("A")).historyCount;
  const again = page.getByRole("button", { name: /Again/u });
  await again.dblclick();
  await expect.poll(async () => (await userState("A")).historyCount).toBe(before + 1);
});

test("Review progress is isolated by user and CSRF/exact-version checks reject forged requests", async ({ browser, page }) => {
  diagnostics.allowExpectedNetworkErrors();
  await login(page, "A", reviewRoute);
  await page.locator("#review-session").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".review-answer")).toBeVisible();
  await page.keyboard.press("1");
  await expect.poll(async () => (await userState("A")).historyCount).toBe(1);
  expect((await userState("B")).historyCount).toBe(0);

  const packageId = process.env.WSM_E2E_REVIEW_PACKAGE;
  const forged = await page.evaluate(async ({ packageId }) => (await fetch(`/api/review/session?packageId=${encodeURIComponent(packageId)}&version=9.9.9&sourcePath=${encodeURIComponent("units/core/chapter-010-ten/chapter.md")}`)).status, { packageId });
  expect(forged).toBe(403);
  const omitted = await page.evaluate(async packageId => (await fetch(`/api/review/session?packageId=${encodeURIComponent(packageId)}`)).status, packageId);
  expect(omitted).toBe(400);
  const csrf = await page.evaluate(async packageId => (await fetch("/api/review/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageId, packageVersion: "1.0.0", sourcePath: "units/core/chapter-010-ten/chapter.md", itemId: "stable-browser-card" }) })).status, packageId);
  expect(csrf).toBe(403);

  const context = await browser.newContext();
  const other = await context.newPage();
  const otherDiagnostics = captureDiagnostics(other);
  await login(other, "B", reviewRoute);
  await expect(other.locator(".review-card")).toBeVisible();
  expect((await userState("B")).historyCount).toBe(0);
  expect(otherDiagnostics.issues).toEqual([]);
  await context.close();
});

test("unsafe Review content is inert and narrow Review layout does not overflow", async ({ page }) => {
  await login(page, "A", reviewRoute);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await page.locator(".review-prompt").getByText("<img", { exact: false }).count()) break;
    await page.locator("#review-session").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("4");
    await expect(page.locator(".review-card")).toBeVisible();
  }
  await expect(page.locator(".review-prompt img, .review-prompt script")).toHaveCount(0);
  await expect(page.locator(".review-prompt")).toContainText("<img src=x onerror=alert(1)> remains text");
  await page.locator("#review-session").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".review-answer script, .review-answer a")).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, session: document.querySelector("#review-session").scrollWidth, client: document.querySelector("#review-session").clientWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.session).toBeLessThanOrEqual(dimensions.client + 1);
});
