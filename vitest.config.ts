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
    // Integration tests share a local Supabase instance — running them in
    // parallel means beforeEach(resetTestData) stomps on in-flight tests.
    // Disabling file-level parallelism is enough; within a file, tests
    // already sequence via beforeEach.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
