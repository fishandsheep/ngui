import { defineConfig, devices } from "@playwright/test";

const localNoProxy = "127.0.0.1,localhost";
process.env.NO_PROXY = [process.env.NO_PROXY, localNoProxy].filter(Boolean).join(",");
process.env.no_proxy = [process.env.no_proxy, localNoProxy].filter(Boolean).join(",");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: "http://127.0.0.1:5176",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5176",
    env: {
      NO_PROXY: localNoProxy,
      no_proxy: localNoProxy
    },
    url: "http://127.0.0.1:5176",
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
