import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Node is the default env — unit tests under lib/ are pure logic.
    // Tests that need DOM opt in via `// @vitest-environment jsdom` at file top.
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
