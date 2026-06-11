import { defineConfig } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  use: { baseURL: BASE },
  webServer: {
    command: "npm run dev",
    url: BASE,
    reuseExistingServer: !process.env.CI,
  },
});
