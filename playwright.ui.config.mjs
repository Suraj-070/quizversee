import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /ui-smoke\.spec\.mjs/,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "bun run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./ui-smoke.sqlite",
      NEXTAUTH_URL: "http://127.0.0.1:3000",
      NEXTAUTH_SECRET: "ui-smoke-ci-only-not-for-deployments",
    },
  },
});
