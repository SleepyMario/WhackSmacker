import { test, expect } from "@playwright/test";
import { captureDiagnostics, deepLink, login, resetUsers } from "./helpers.mjs";

test("reader remains keyboard-usable without destructive page overflow", async ({ page }) => {
  await resetUsers();
  const diagnostics = captureDiagnostics(page);
  await login(page, "A", deepLink());
  await expect(page.locator("#curriculum")).toBeVisible();
  await expect(page.locator("#source-locale")).toHaveCount(1);
  await page.locator("#menu-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#sidebar")).toHaveClass(/open/u);
  await expect(page.locator(".primary-nav button").first()).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-toggle")).toBeFocused();
  await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.locator("#chapters button", { hasText: "Chapter 10" }).focus();
  const focusStyle = await page.locator("#chapters button", { hasText: "Chapter 10" }).evaluate(node => getComputedStyle(node).outlineStyle);
  expect(focusStyle).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator("#reader")).toBeFocused();
  await expect(page.locator("#previous")).toBeVisible();
  await expect(page.locator("#next")).toBeVisible();
  await expect(page.locator("#chapter-content table")).toBeVisible();
  await expect(page.locator("#chapters")).toContainText("第十一章");
  const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(diagnostics.issues, diagnostics.issues.join("\n")).toEqual([]);
});

test("Review remains keyboard-usable without horizontal overflow", async ({ page }) => {
  await resetUsers();
  const diagnostics = captureDiagnostics(page);
  await login(page, "A", "/app?view=review");
  await expect(page.locator("#review-session")).toBeVisible();
  await expect(page.locator(".review-answer")).toHaveCount(0);
  await page.locator("#review-session").focus();
  const focusStyle = await page.locator("#review-session").evaluate(node => getComputedStyle(node).outlineStyle);
  expect(focusStyle).not.toBe("none");
  await page.keyboard.press("Space");
  await expect(page.locator(".review-answer")).toBeVisible();
  await expect(page.locator(".rating-button")).toHaveCount(4);
  const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, session: document.querySelector("#review-session").scrollWidth, client: document.querySelector("#review-session").clientWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.session).toBeLessThanOrEqual(dimensions.client + 1);
  expect(diagnostics.issues, diagnostics.issues.join("\n")).toEqual([]);
});
