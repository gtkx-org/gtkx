/// <reference path="./eslint-plugin-promise.d.ts" />

import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import perfectionist from "eslint-plugin-perfectionist";
import promise from "eslint-plugin-promise";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import { join } from "node:path";
import tseslint from "typescript-eslint";
import { gtkx } from "./plugin.js";

const SOURCES = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];

const TESTS = ["**/tests/**/*.{ts,tsx}", "**/*.{test,spec,bench}.{ts,tsx}"];

const CORE_SOURCES = ["packages/*/src/**/*.{ts,tsx}"];

const ADW_SOURCES = ["packages/react/src/adw/**", "packages/components/src/adw/**"];

const ADW_CORE_MESSAGE =
    "Adwaita must stay out of the core graph. Put Adwaita-dependent code under a dedicated adw subpath (packages/react/src/adw or packages/components/src/adw) and reach it from the generated adw module.";

const ADW_ENTRYPOINT_MESSAGE =
    "Only the ./adw entrypoint may reference the Adwaita bindings, so projects that do not declare Adw-1 still typecheck.";

const NAMING_CONVENTION = [
    { selector: "default", format: ["camelCase"], leadingUnderscore: "allow", trailingUnderscore: "allow" },
    { selector: "import", format: ["camelCase", "PascalCase"] },
    { selector: "variable", format: ["camelCase", "PascalCase", "UPPER_CASE"], leadingUnderscore: "allow" },
    { selector: "function", format: ["camelCase", "PascalCase"] },
    { selector: "parameter", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
    { selector: "memberLike", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
    { selector: "typeLike", format: ["PascalCase"] },
    { selector: "typeAlias", format: null, custom: { regex: "^[A-Z][a-zA-Z0-9]*$", match: true } },
    { selector: "typeParameter", format: null, custom: { regex: "^T?[A-Z][a-zA-Z0-9]*$", match: true } },
    { selector: "enumMember", format: ["UPPER_CASE", "PascalCase"] },
    {
        selector: ["objectLiteralProperty", "typeProperty"],
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
    },
    { selector: ["objectLiteralProperty", "typeProperty"], format: null, modifiers: ["requiresQuotes"] },
];

export const config = (root: string) =>
    tseslint.config(
        includeIgnoreFile(join(root, ".gitignore")),
        {
            ignores: [
                "examples/**",
                "website/**",
                "**/*.vue",
                "packages/create-gtkx/src/templates/**",
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
            files: SOURCES,
            extends: [
                js.configs.recommended,
                tseslint.configs.strictTypeChecked,
                tseslint.configs.stylisticTypeChecked,
                sonarjs.configs.recommended,
                promise.configs["flat/recommended"],
                reactHooks.configs.flat.recommended,
                unicorn.configs.recommended,
                stylistic.configs.customize({
                    indent: 4,
                    quotes: "double",
                    semi: true,
                    jsx: true,
                    arrowParens: true,
                    braceStyle: "1tbs",
                    commaDangle: "always-multiline",
                    quoteProps: "as-needed",
                }),
            ],
            languageOptions: {
                parserOptions: {
                    projectService: true,
                    tsconfigRootDir: root,
                },
            },
            plugins: { gtkx, perfectionist },
            rules: {
                "@stylistic/max-len": [
                    "error",
                    {
                        code: 120,
                        ignoreComments: true,
                        ignoreUrls: true,
                        ignoreStrings: true,
                        ignoreTemplateLiterals: true,
                        ignoreRegExpLiterals: true,
                    },
                ],
                "@stylistic/comma-dangle": [
                    "error",
                    {
                        arrays: "always-multiline",
                        dynamicImports: "always-multiline",
                        enums: "always-multiline",
                        exports: "always-multiline",
                        functions: "always-multiline",
                        generics: "ignore",
                        importAttributes: "always-multiline",
                        imports: "always-multiline",
                        objects: "always-multiline",
                        tuples: "always-multiline",
                    },
                ],
                "@stylistic/jsx-curly-brace-presence": ["error", { props: "never", children: "ignore" }],
                "@stylistic/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: "never" }],
                "@stylistic/jsx-one-expression-per-line": "off",
                "@stylistic/operator-linebreak": ["error", "after", { overrides: { "?": "before", ":": "before" } }],
                "@typescript-eslint/array-type": ["error", { default: "array" }],
                "@typescript-eslint/consistent-generic-constructors": ["error", "type-annotation"],
                "@typescript-eslint/consistent-type-definitions": ["error", "type"],
                "@typescript-eslint/naming-convention": ["error", ...NAMING_CONVENTION],
                "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
                "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
                "@typescript-eslint/no-unnecessary-type-assertion": "off",
                "@typescript-eslint/non-nullable-type-assertion-style": "off",
                "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
                "gtkx/cognitive-complexity": ["error", { max: 10 }],
                "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
                "max-params": ["error", { max: 4 }],
                "perfectionist/sort-imports": [
                    "error",
                    { type: "natural", order: "asc", ignoreCase: true, newlinesBetween: "ignore" },
                ],
                "perfectionist/sort-named-imports": ["error", { type: "natural", order: "asc", ignoreCase: true }],
                "sonarjs/cognitive-complexity": "off",
                "sonarjs/prefer-read-only-props": "off",
                "unicorn/consistent-boolean-name": "off",
                "unicorn/filename-case": ["error", { case: "kebabCase" }],
                "unicorn/import-style": ["error", { styles: { path: { default: false, named: true } } }],
                "unicorn/name-replacements": "off",
                "unicorn/no-array-splice": "off",
                "unicorn/no-null": "off",
                "unicorn/no-this-outside-of-class": "off",
                "unicorn/no-useless-undefined": ["error", { checkArrowFunctionBody: false }],
                "unicorn/prefer-https": "off",
                "unicorn/no-process-exit": "off",
                "unicorn/no-top-level-assignment-in-function": "off",
                "unicorn/prefer-event-target": "off",
            },
        },
        {
            files: ["packages/gl/**/*.{ts,tsx}", "packages/react/src/hooks/use-bind-setting.ts"],
            rules: { "max-params": "off" },
        },
        {
            files: CORE_SOURCES,
            ignores: ADW_SOURCES,
            rules: {
                "@typescript-eslint/no-restricted-imports": [
                    "error",
                    {
                        paths: [
                            { name: "@gtkx/gi/adw", message: ADW_CORE_MESSAGE },
                            { name: "@gtkx/jsx/adw", message: ADW_CORE_MESSAGE },
                        ],
                    },
                ],
            },
        },
        {
            files: ["packages/react/src/**/*.{ts,tsx}", "packages/components/src/**/*.{ts,tsx}"],
            ignores: ADW_SOURCES,
            rules: {
                "@typescript-eslint/no-restricted-imports": [
                    "error",
                    {
                        paths: [
                            { name: "@gtkx/gi/adw", message: ADW_ENTRYPOINT_MESSAGE },
                            { name: "@gtkx/jsx/adw", message: ADW_ENTRYPOINT_MESSAGE },
                            { name: "@gtkx/react/adw", message: ADW_ENTRYPOINT_MESSAGE },
                        ],
                    },
                ],
            },
        },
        {
            files: TESTS,
            extends: [vitest.configs.recommended],
            rules: {
                "@typescript-eslint/require-await": "off",
                "@typescript-eslint/unbound-method": "off",
                "max-lines-per-function": "off",
                "sonarjs/assertions-in-tests": "off",
                "vitest/expect-expect": "off",
                "vitest/unbound-method": "error",
            },
        },
        {
            files: ["**/*.d.ts"],
            rules: { "@typescript-eslint/consistent-type-definitions": "off" },
        },
        {
            files: ["**/*.{js,jsx,mjs,cjs}"],
            extends: [tseslint.configs.disableTypeChecked],
        },
    );
