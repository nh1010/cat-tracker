import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "build/**", "coverage/**", "*.config.*"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        File: "readonly",
        FormData: "readonly",
        HTMLElement: "readonly",
        sessionStorage: "readonly",
        window: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
    },
  }
);
