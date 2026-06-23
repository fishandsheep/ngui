import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/ngui/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["node_modules", "dist", "tests/e2e/**"],
    setupFiles: "./src/test/setup.ts"
  }
});
