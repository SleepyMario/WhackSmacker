import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

export default defineConfig({
  testDir: "./test/e2e",
  globalSetup: "./test/e2e/global-setup.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  outputDir: join(tmpdir(), `whacksmacker-playwright-${process.pid}`),
  reporter: "list",
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off"
  },
  projects: [
    { name: "chromium-desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } }, testMatch: /(?:reader|review)\.spec\.mjs/ },
    { name: "chromium-320", use: { browserName: "chromium", viewport: { width: 320, height: 720 } }, testMatch: /responsive\.spec\.mjs/ },
    { name: "chromium-375", use: { browserName: "chromium", viewport: { width: 375, height: 812 } }, testMatch: /responsive\.spec\.mjs/ },
    { name: "chromium-768", use: { browserName: "chromium", viewport: { width: 768, height: 1024 } }, testMatch: /responsive\.spec\.mjs/ },
    { name: "visual-1440", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } }, testMatch: /visual\.spec\.mjs/ },
    { name: "visual-1024", use: { browserName: "chromium", viewport: { width: 1024, height: 768 } }, testMatch: /visual\.spec\.mjs/ },
    { name: "visual-768", use: { browserName: "chromium", viewport: { width: 768, height: 1024 } }, testMatch: /visual\.spec\.mjs/ },
    { name: "visual-390", use: { browserName: "chromium", viewport: { width: 390, height: 844 } }, testMatch: /visual\.spec\.mjs/ },
    { name: "visual-320", use: { browserName: "chromium", viewport: { width: 320, height: 568 } }, testMatch: /visual\.spec\.mjs/ },
    { name: "firefox-desktop", use: { browserName: "firefox", viewport: { width: 1280, height: 800 } }, testMatch: /(?:reader|review)\.spec\.mjs/ }
  ]
});
