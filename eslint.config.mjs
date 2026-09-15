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

    // Generated tool bundles are uploaded artifacts, not source code.
    "packages/*/dist/**",
    "packages/*/artifacts/**",
    // Upstream easydraw editor mirrored verbatim (see packages/easydraw-tool/README.md);
    // it is linted in its own repository with its own config.
    "packages/easydraw-tool/editor/**",
    ".tmp/**",

    // Code tham khảo, không phải của ứng dụng — không lint, không typecheck.
    "reference/**",
    "base44reference/**",
  ]),
]);

export default eslintConfig;
