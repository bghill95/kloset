import { defineConfig } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4100";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  use: {
    baseURL: BASE,
    launchOptions: {
      // Auto-grant camera permission and feed a synthetic test pattern so the
      // viewfinder works headlessly.
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: BASE,
    reuseExistingServer: !process.env.CI,
    // PEXELS_API_KEY is blanked so Explore stays on canned pins even when the
    // developer's .env.local has a real key (a real key overrides MOCK_AI).
    env: { ...process.env, MOCK_AI: "1", PEXELS_API_KEY: "" } as Record<string, string>,
  },
});
