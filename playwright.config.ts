import { defineConfig, devices } from "@playwright/test";

const hasExternalBaseUrl = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: hasExternalBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: "http://127.0.0.1:3100",
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
