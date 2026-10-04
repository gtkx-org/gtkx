import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import vue from "eslint-plugin-vue";
import globals from "globals";
import { join } from "node:path";
import tseslint from "typescript-eslint";

export default defineConfig(
    includeIgnoreFile(join(import.meta.dirname, ".gitignore")),
    {
        ignores: [
            ".claude/**",
            ".codescythe-*/**",
            "packages/native/npm/**",
            "packages/native/target/**",
            "packages/native/artifacts/**",
            "packages/native/index.js",
            "packages/native/index.d.ts",
            "website/.vitepress/cache/**",
            "website/.vitepress/dist/**",
            "website/.vitepress/.temp/**",
        ],
    },
    {
        files: ["**/*.{ts,tsx,mts,cts}"],
        extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        rules: {
            "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
        },
    },
    {
        files: ["**/gtkx-env.d.ts"],
        rules: { "@typescript-eslint/triple-slash-reference": "off" },
    },
    {
        files: ["**/*.{js,jsx,mjs,cjs}"],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: globals.node,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
    },
    {
        files: ["**/*.{ts,tsx,js,jsx}"],
        extends: [reactHooks.configs.flat.recommended],
    },
    {
        files: ["**/tests/**/*.{ts,tsx}", "**/*.{test,spec,bench}.{ts,tsx}"],
        extends: [vitest.configs.recommended],
        rules: {
            "@typescript-eslint/unbound-method": "off",
            "vitest/unbound-method": "error",
            "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "assert", "expect*"] }],
            "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
        },
    },
    {
        files: ["website/**/*.vue"],
        extends: [tseslint.configs.recommended, vue.configs["flat/essential"]],
        languageOptions: { parserOptions: { parser: tseslint.parser } },
        rules: { "vue/multi-word-component-names": "off" },
    },
);
