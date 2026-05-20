import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude design canvas — kept as reference, not production code:
    "design/**",
    // Design-handoff bundles (canvas JSX reference, not source):
    "design_handoff_phase11/**",
    "design_handoff_standings/**",
  ]),
]);

export default eslintConfig;
