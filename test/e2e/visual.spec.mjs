import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { baseUrl, captureDiagnostics, chapter, deepLink, login, resetUsers, revokeUserA } from "./helpers.mjs";

test("preferred reader states remain visually and structurally stable", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await resetUsers();
  const diagnostics = captureDiagnostics(page);
  diagnostics.expectRequestFailure("/api/settings");
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const viewportName = `${viewport.width}x${viewport.height}`;

  await login(page, "A", deepLink({ chapterId: chapter(10) }));
  await capture("reader-normal-dark-en");

  await setMode("Expert");
  await expect(page.locator("#chapter-content")).toContainText("Expert linguistic guidance.");
  await capture("reader-expert-dark-en");

  await setMode("Developer");
  await expect(page.locator("#chapter-content")).toContainText("Normal reader guidance.");
  await expect(page.locator("#chapter-content")).toContainText("Expert linguistic guidance.");
  await capture("reader-developer-dark-en");

  await setMode("Normal");
  await keyboardToggle("#translation-toggle");
  await expect(page.locator("#chapter-content")).toContainText("Natural English Translation");
  await capture("reader-translation-dark-en");
  await keyboardToggle("#translation-toggle");

  await keyboardToggle("#characters-toggle");
  await expect(page.locator("#chapter-content")).toContainText("Normal character support.");
  await capture("reader-characters-dark-en");
  await keyboardToggle("#characters-toggle");

  await keyboardToggle("#breakdown-toggle");
  await expect(page.locator("#chapter-content")).toContainText("Normal line breakdown.");
  await capture("reader-breakdown-dark-en");
  await keyboardToggle("#breakdown-toggle");

  await page.goto(`${baseUrl()}${deepLink({ locale: "zh-TW", chapterId: chapter(10) })}`);
  await expect(page.locator("#overlay")).toContainText(/Traditional Chinese.*active/iu);
  await capture("reader-normal-dark-zh");

  await page.locator("#chapters button", { hasText: "Chapter 11" }).click();
  await expect(page.locator("#overlay")).toContainText(/Showing English fallback/iu);
  await capture("reader-fallback-dark-zh");

  await page.goto(`${baseUrl()}${deepLink({ locale: "en", chapterId: chapter(11) })}`);
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#status")).toContainText("Theme saved");
  await capture("reader-normal-light-en");
  if (viewport.width <= 800) {
    await page.locator("#menu-toggle").click();
    await expect(page.locator("#sidebar")).toHaveClass(/open/u);
  }
  await page.evaluate(() => {
    const rule = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]).find(candidate => candidate.selectorText === 'html[data-theme="light"]');
    const values = {
      "--sidebar-bg": "#081321", "--sidebar-border": "#d5dce8", "--sidebar-text": "#aeb8c8", "--sidebar-muted": "#7f8a9b",
      "--sidebar-icon": "#9150dc", "--sidebar-hover-border": "#263750", "--sidebar-hover-bg": "#0c1828",
      "--sidebar-active-border": "#6930ad", "--sidebar-active-from": "#28134f", "--sidebar-active-to": "#16152c",
      "--sidebar-footer-bg": "#0a1422", "--sidebar-footer-border": "#263750", "--sidebar-footer-muted": "#5f6978"
    };
    window.__wsmLightSidebarRule = rule;
    window.__wsmLightSidebarValues = Object.fromEntries(Object.keys(values).map(name => [name, rule.style.getPropertyValue(name)]));
    for (const [name, value] of Object.entries(values)) rule.style.setProperty(name, value);
  });
  await capture("reader-sidebar-light-before-en");
  await page.evaluate(() => {
    for (const [name, value] of Object.entries(window.__wsmLightSidebarValues)) window.__wsmLightSidebarRule.style.setProperty(name, value);
    delete window.__wsmLightSidebarRule;
    delete window.__wsmLightSidebarValues;
  });
  await capture("reader-sidebar-light-after-en");
  if (viewport.width <= 800) {
    await page.keyboard.press("Escape");
    await expect(page.locator("#sidebar")).not.toHaveClass(/open/u);
  }

  await page.locator("#theme-toggle").click();
  await page.goto(`${baseUrl()}${deepLink({ version: "9.9.9" })}`);
  await expect(page.locator("#status")).toContainText(/unavailable|not authorized/iu);
  await capture("reader-unavailable-version-dark-en");

  await page.goto(`${baseUrl()}${deepLink({ chapterId: chapter(10) })}`);
  await expect(page.locator("#status")).toContainText("loaded");
  await page.route("**/api/curriculum/chapter?**", async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  }, { times: 1 });
  const loading = page.locator("#chapters button", { hasText: "Chapter 11" }).click();
  await expect(page.locator("#status")).toContainText("Loading chapter");
  await capture("reader-loading-dark-en");
  await loading;
  await expect(page.locator("#chapter-title")).toContainText("Chapter 11");

  diagnostics.allowExpectedNetworkErrors();
  await page.route("**/api/curriculum/chapter?**", route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "synthetic corrupt package", requestId: "visual-fixture" }) }), { times: 1 });
  await page.locator("#chapters button", { hasText: "Chapter 10" }).click();
  await expect(page.locator("#status")).toContainText(/could not read/iu);
  await capture("reader-corrupt-error-dark-en");

  await page.route("**/api/curricula", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requestedSourceLocale: "en", curricula: [], unavailable: [] }) }), { times: 1 });
  await page.goto(`${baseUrl()}/app`);
  await expect(page.locator("#status")).toContainText("No language curricula are selected");
  await capture("reader-no-curriculum-dark-en");

  await page.route("**/api/curriculum/chapter?**", async route => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, contentType: "application/json", body: JSON.stringify({ ...body, text: "\n" }) });
  }, { times: 1 });
  await page.goto(`${baseUrl()}${deepLink({ chapterId: chapter(10) })}`);
  await expect(page.locator("#chapter-content")).toContainText("no readable content");
  await capture("reader-empty-chapter-dark-en");

  await page.goto(`${baseUrl()}/app?view=review`);
  await expect(page.locator(".review-card")).toBeVisible();
  await capture("review-package-source-selection-dark-en");
  await capture("review-hidden-answer-dark-en");
  await page.locator("#review-session").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".review-answer")).toBeVisible();
  await capture("review-revealed-answer-dark-en");
  for (const rating of ["again", "hard", "good", "easy"]) {
    await page.locator(`.rating-button[data-rating="${rating}"]`).focus();
    await capture(`review-rating-${rating}-focus-dark-en`);
  }
  await page.locator('.rating-button[data-rating="good"]').click();
  await expect(page.locator(".review-card")).toBeVisible();
  await expect(page.locator(".review-answer")).toHaveCount(0);
  await expect(page.locator(".review-prompt")).toContainText("<img src=x onerror=alert(1)> remains text");
  await page.locator("#review-session").focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".review-answer")).toBeVisible();
  await expect(page.locator("#status")).toContainText("Answer revealed");
  await expect(page.locator("#review-session")).toHaveAttribute("aria-busy", "false");
  await page.locator('.rating-button[data-rating="easy"]').click();
  await expect(page.locator("#review-session")).toContainText("Session complete");
  await capture("review-session-completion-dark-en");
  await capture("review-no-cards-due-dark-en");

  await page.route("**/api/review", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ packages: [], unavailable: [] }) }), { times: 1 });
  await page.goto(`${baseUrl()}/app?view=review`);
  await expect(page.locator("#review-session")).toContainText("No Review packages");
  await capture("review-empty-packages-dark-en");

  await page.route("**/api/review/session?**", route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "synthetic Review failure", requestId: "review-visual-fixture" }) }), { times: 1 });
  await page.goto(`${baseUrl()}/app?view=review`);
  await expect(page.locator("#review-session")).toContainText("Could not load this session");
  await capture("review-error-dark-en");

  await page.locator("#source-locale").selectOption("zh-TW", { force: true });
  await expect(page.locator("#status")).toContainText("Source language saved");
  await expect(page.locator("#review-session")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => localStorage.setItem("whacksmacker.ui-locale", "zh-TW"));
  await page.reload();
  await expect(page.locator("#review-sources-title")).toContainText("牌組");
  await capture("review-no-cards-due-dark-zh");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await capture("review-no-cards-due-light-zh");

  await page.goto(`${baseUrl()}${deepLink({ chapterId: chapter(10) })}`);
  await expect(page.locator("#chapter-title")).toContainText("Chapter 10");
  await revokeUserA();
  await page.locator("#theme-toggle").click();
  await expect(page).toHaveURL(/\/login\?returnTo=/u);
  await capture("expired-session");

  expect(diagnostics.issues, diagnostics.issues.join("\n")).toEqual([]);

  async function keyboardToggle(selector) {
    const control = page.locator(selector);
    const before = await control.isChecked();
    await control.focus();
    await page.keyboard.press("Space");
    if (before) await expect(control).not.toBeChecked();
    else await expect(control).toBeChecked();
    await expect(page.locator("#status")).toContainText("loaded");
  }

  async function setMode(name) {
    const button = page.getByRole("button", { name });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#status")).toContainText("loaded");
  }

  async function capture(state) {
    const base = `${state}-${viewportName}`;
    const outputRoot = process.env.WSM_REVIEW_ARTIFACT_DIR;
    const screenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
    expect(screenshot.byteLength).toBeGreaterThan(5_000);
    const dom = await page.locator("body").evaluate(node => node.outerHTML);
    const accessibility = await page.locator("body").ariaSnapshot();
    const metrics = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const shellElement = document.querySelector(".app-shell");
      const reviewVisible = !document.querySelector("#view-review")?.hidden;
      const header = document.querySelector(".app-header")?.getBoundingClientRect();
      const reader = document.querySelector("#reader")?.getBoundingClientRect();
      const readerElement = document.querySelector("#reader");
      const contentElement = document.querySelector("#chapter-content");
      const sidebar = document.querySelector("#sidebar")?.getBoundingClientRect();
      const review = document.querySelector("#review-session")?.getBoundingClientRect();
      const reviewElement = document.querySelector("#review-session");
      return {
        surface: shellElement ? (reviewVisible ? "review" : "reader") : "login",
        theme: document.documentElement.dataset.theme,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        headerHeight: Math.round(header?.height ?? 0),
        sidebarWidth: Math.round(sidebar?.width ?? 0),
        readerWidth: Math.round(reader?.width ?? 0),
        readerClientWidth: readerElement?.clientWidth ?? 0,
        readerScrollWidth: readerElement?.scrollWidth ?? 0,
        contentClientWidth: contentElement?.clientWidth ?? 0,
        contentScrollWidth: contentElement?.scrollWidth ?? 0,
        reviewWidth: Math.round(review?.width ?? 0),
        reviewClientWidth: reviewElement?.clientWidth ?? 0,
        reviewScrollWidth: reviewElement?.scrollWidth ?? 0,
        gridColumns: shellElement ? getComputedStyle(shellElement).gridTemplateColumns : "",
        colors: { background: root.getPropertyValue("--bg").trim(), panel: root.getPropertyValue("--panel").trim(), ink: root.getPropertyValue("--ink").trim() }
      };
    });
    expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    if (metrics.surface === "reader") {
      expect(metrics.headerHeight).toBe(68);
      expect(metrics.readerScrollWidth).toBeLessThanOrEqual(metrics.readerClientWidth + 1);
      expect(metrics.contentScrollWidth).toBeLessThanOrEqual(metrics.contentClientWidth + 1);
      if (viewport.width > 800) expect(metrics.sidebarWidth).toBeGreaterThanOrEqual(190);
    }
    if (metrics.surface === "review") {
      expect(metrics.headerHeight).toBe(68);
      expect(metrics.reviewScrollWidth).toBeLessThanOrEqual(metrics.reviewClientWidth + 1);
      if (viewport.width > 800) expect(metrics.sidebarWidth).toBeGreaterThanOrEqual(190);
    }
    if (outputRoot) {
      await mkdir(join(outputRoot, "screenshots"), { recursive: true });
      await mkdir(join(outputRoot, "dom"), { recursive: true });
      await mkdir(join(outputRoot, "accessibility"), { recursive: true });
      await writeFile(join(outputRoot, "screenshots", `${base}.png`), screenshot);
      await writeFile(join(outputRoot, "dom", `${base}.html`), dom);
      await writeFile(join(outputRoot, "accessibility", `${base}.yml`), accessibility);
      await writeFile(join(outputRoot, "dom", `${base}.metrics.json`), `${JSON.stringify(metrics, null, 2)}\n`);
    } else {
      await writeFile(testInfo.outputPath(`${base}.png`), screenshot);
      await writeFile(testInfo.outputPath(`${base}.html`), dom);
      await writeFile(testInfo.outputPath(`${base}.aria.yml`), accessibility);
    }
  }
});
