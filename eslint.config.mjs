import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    /**
     * No debug logging in application code.
     *
     * `console.log`/`debug`/`info` were used to dump `$filter` query params,
     * stored-procedure parameters, PUT request bodies and full MP result sets —
     * names, email addresses, phone numbers — into hosting and log-aggregation
     * platforms, which typically have broader access and longer retention than
     * the Ministry Platform database itself.
     *
     * `warn` and `error` stay allowed, on the rule that they log IDENTIFIERS
     * AND SHAPE only (table, IDs, HTTP status), never record content.
     *
     * Generator scripts are exempt: they are CLI tools whose entire output is
     * console-based and which never touch member data.
     */
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/providers/ministry-platform/scripts/**",
      "**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
