import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // Unit tests live under lib/ — e2e specs live in e2e/ and belong to Playwright.
    include: ["lib/**/*.test.ts", "lib/**/*.spec.ts"],
    environment: "node",
  },
});
