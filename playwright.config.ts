import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
    // iPhone 14 / iPad Mini device descriptors default to WebKit, which
    // isn't installed on this machine — pin chromium. Only the viewport
    // (390x664 / 768x1024) matters for the overflow + fork checks below,
    // not the rendering engine.
    { name: "iPhone 14", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    { name: "Pixel 7", use: { ...devices["Pixel 7"] } },
    { name: "iPad Mini", use: { ...devices["iPad Mini"], browserName: "chromium" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
