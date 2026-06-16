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
        command: "RESEND_API_KEY= RESEND_FROM_EMAIL= FOLLOW_UP_EMAIL_ENABLED=0 CRON_SECRET=e2e-cron-secret STRIPE_WEBHOOK_SECRET=whsec_e2e_test AI_CHAT_DISABLE_MODEL=1 npm run dev -- --hostname 127.0.0.1 --port 3100",
        reuseExistingServer: false,
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
