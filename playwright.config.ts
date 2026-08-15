import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3100",
    env: { E2E_FIXTURES: "1" },
    url: "http://127.0.0.1:3100/rounds/new",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
