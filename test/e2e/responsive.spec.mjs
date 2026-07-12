import { test, expect } from "@playwright/test";
import { captureDiagnostics, deepLink, login, resetUsers } from "./helpers.mjs";

test("reader remains keyboard-usable without destructive page overflow", async ({ page }) => {
  await resetUsers();
  const diagnostics = captureDiagnostics(page);
  await login(page, "A", deepLink());
  await expect(page.locator("#curriculum")).toBeVisible();
  await expect(page.locator('input[value="zh-TW"]')).toBeVisible();
  await page.locator("#chapters button", { hasText: "Chapter 10" }).focus();
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
