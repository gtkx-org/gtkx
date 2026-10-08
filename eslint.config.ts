import vitest from "@vitest/eslint-plugin";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import vue from "eslint-plugin-vue";
import { join } from "node:path";
import tseslint from "typescript-eslint";

export default defineConfig(
    includeIgnoreFile(
        [".gitignore", "packages/native/.gitignore", "website/.gitignore"].map((path) =>
            join(import.meta.dirname, path),
        ),
        { gitignoreResolution: true },
    ),
    { ignores: [".codescythe-*/**", "**/*.{js,jsx,mjs}"] },
    {
        files: ["**/tests/**/*.{ts,tsx}", "**/*.{test,spec,bench}.{ts,tsx}"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        plugins: { vitest },
        rules: { "vitest/unbound-method": "error" },
    },
    {
        files: ["packages/react/src/components/controlled.tsx", "packages/e2e/tests/react/layout-effects.test.tsx"],
        languageOptions: { parser: tseslint.parser },
        plugins: { "react-hooks": { rules: reactHooks.rules, meta: reactHooks.meta } },
    },
    {
        files: ["packages/react/src/components/controlled.tsx"],
        rules: { "react-hooks/refs": "error" },
    },
    {
        files: ["packages/e2e/tests/react/layout-effects.test.tsx"],
        rules: { "react-hooks/set-state-in-effect": "error" },
    },
    {
        files: ["**/*.cjs"],
        rules: { "no-dupe-args": "error", "no-octal": "error" },
    },
    {
        files: ["website/**/*.vue"],
        extends: [tseslint.configs.recommended, vue.configs["flat/essential"]],
        languageOptions: {
            parserOptions: { parser: tseslint.parser },
        },
        rules: { "vue/multi-word-component-names": "off" },
    },
);
