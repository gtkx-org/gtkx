import type { TSESLint } from "@typescript-eslint/utils";
import type { Linter } from "eslint";
import js from "@eslint/js";
import nx from "@nx/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";
import vitest from "@vitest/eslint-plugin";
import perfectionist from "eslint-plugin-perfectionist";
import promise from "eslint-plugin-promise";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import { includeIgnoreFile } from "eslint/config";
import * as jsonc from "jsonc-eslint-parser";
import { join } from "node:path";
import tseslint from "typescript-eslint";
import { gtkx } from "./plugin.js";

type FlatConfig = TSESLint.FlatConfig.Config;

type PublicApi = {
    entrypoints: string[];
    modules: { path: string }[];
};

const SOURCES = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];
const JS_SOURCES = ["**/*.{js,jsx,mjs,cjs}"];
const TS_SOURCES = ["**/*.{ts,tsx,mts,cts}"];
const TESTS = ["**/tests/**/*.{ts,tsx}", "**/*.{test,spec,bench}.{ts,tsx}"];
const CORE_SOURCES = ["packages/*/src/**/*.{ts,tsx}"];
const ADW_SOURCES = ["packages/react/src/adw/**", "packages/components/src/adw/**"];
const MANIFESTS = ["packages/*/package.json"];
const TOOLING = ["**/*.config.{ts,mts,cts,js,mjs,cjs}", "**/*.config.base.ts", "**/scripts/**/*.ts"];
const TYPE_ONLY_DEPS = ["@types/ejs", "@types/node", "@types/react"];
const DEPENDENCY_CHECKS = { checkObsoleteDependencies: false };
const CLI_OPTIONAL_DEPS = ["@gtkx/native", "@gtkx/react", "@gtkx/testing", "vitest"];

const NX_CONFIGS: FlatConfig[] = [
    {
        files: SOURCES,
        ignores: [...TESTS, ...TOOLING],
        plugins: { "@nx": nx },
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [],
                    checkDynamicDependenciesExceptions: [".*"],
                    depConstraints: [{ sourceTag: "*", onlyDependOnLibsWithTags: ["*"] }],
                },
            ],
        },
    },
    {
        files: MANIFESTS,
        plugins: { "@nx": nx },
        languageOptions: { parser: jsonc },
        rules: { "@nx/dependency-checks": ["error", { ...DEPENDENCY_CHECKS, ignoredDependencies: TYPE_ONLY_DEPS }] },
    },
    {
        files: ["packages/react/package.json"],
        plugins: { "@nx": nx },
        languageOptions: { parser: jsonc },
        rules: {
            "@nx/dependency-checks": [
                "error",
                { ...DEPENDENCY_CHECKS, ignoredDependencies: [...TYPE_ONLY_DEPS, "@gtkx/config"] },
            ],
        },
    },
    {
        files: ["packages/cli/package.json"],
        plugins: { "@nx": nx },
        languageOptions: { parser: jsonc },
        rules: {
            "@nx/dependency-checks": [
                "error",
                { ...DEPENDENCY_CHECKS, ignoredDependencies: [...TYPE_ONLY_DEPS, ...CLI_OPTIONAL_DEPS] },
            ],
        },
    },
];

const ADW_CORE_MESSAGE =
    "Adwaita must stay out of the core graph. Put Adwaita-dependent code under a dedicated adw subpath " +
    "(packages/react/src/adw or packages/components/src/adw) and reach it from the generated adw module.";

const ADW_ENTRYPOINT_MESSAGE =
    "Only the ./adw entrypoint may reference the Adwaita bindings, so projects that do not declare Adw-1 " +
    "still typecheck.";

const IGNORES = [
    "**/*.vue",
    ".claude/**",
    "examples/tutorial/**",
    "packages/native/npm/**",
    "packages/native/target/**",
    "packages/native/artifacts/**",
    "packages/native/index.js",
    "packages/native/index.d.ts",
    "website/.vitepress/cache/**",
    "website/.vitepress/dist/**",
    "website/.vitepress/.temp/**",
];

const NAMING_CONVENTION = [
    { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
    { selector: "import", format: ["camelCase", "PascalCase"] },
    { selector: "variable", format: ["camelCase", "PascalCase", "UPPER_CASE"], leadingUnderscore: "allow" },
    { selector: "function", format: ["camelCase", "PascalCase"] },
    { selector: "parameter", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
    {
        selector: "memberLike",
        format: ["camelCase", "PascalCase"],
        leadingUnderscore: "allowSingleOrDouble",
        trailingUnderscore: "allowSingleOrDouble",
    },
    { selector: "typeLike", format: ["PascalCase"] },
    { selector: "typeAlias", format: null, custom: { regex: "^[A-Z][a-zA-Z0-9]*$", match: true } },
    { selector: "typeParameter", format: null, custom: { regex: "^T?[A-Z][a-zA-Z0-9]*$", match: true } },
    { selector: "enumMember", format: ["UPPER_CASE", "PascalCase"] },
    {
        selector: ["objectLiteralProperty", "typeProperty"],
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        leadingUnderscore: "allowSingleOrDouble",
        trailingUnderscore: "allowSingleOrDouble",
    },
    { selector: ["objectLiteralProperty", "typeProperty"], format: null, modifiers: ["requiresQuotes"] },
];

const SOURCE_EXTENDS = [
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
];

const SOURCE_RULES: Linter.RulesRecord = {
    "@stylistic/max-len": ["error", { code: 120 }],
    "unicorn/consistent-boolean-name": "error",
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
    "@stylistic/curly-newline": ["error", { minElements: 1 }],
    "@stylistic/jsx-curly-brace-presence": ["error", { props: "never", children: "never" }],
    "@stylistic/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: "never" }],
    "@stylistic/operator-linebreak": ["error", "after", { overrides: { "?": "before", ":": "before" } }],
    "@typescript-eslint/array-type": ["error", { default: "array" }],
    "@typescript-eslint/consistent-generic-constructors": ["error", "type-annotation"],
    "@typescript-eslint/consistent-type-definitions": ["error", "type"],
    "@typescript-eslint/naming-convention": ["error", ...NAMING_CONVENTION],
    "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
    "@typescript-eslint/non-nullable-type-assertion-style": "off",
    "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowAny: false, allowBoolean: false, allowNullish: false, allowNumber: false, allowRegExp: false },
    ],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    curly: ["error", "all"],
    "gtkx/accessor-naming": "error",
    "gtkx/brand-naming": "error",
    "gtkx/cognitive-complexity": ["error", { max: 5 }],
    "gtkx/module-section-order": "error",
    "gtkx/no-comments": "error",
    "gtkx/no-inline-exports": "error",
    "gtkx/no-library-prefix": "error",
    "gtkx/statement-padding": "error",
    "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
    "max-params": ["error", { max: 4 }],
    "perfectionist/sort-exports": [
        "error",
        { type: "natural", order: "asc", ignoreCase: true, newlinesBetween: "ignore" },
    ],
    "perfectionist/sort-imports": [
        "error",
        { type: "natural", order: "asc", ignoreCase: true, newlinesBetween: "ignore" },
    ],
    "perfectionist/sort-named-imports": ["error", { type: "natural", order: "asc", ignoreCase: true }],
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/incompatible-library": "error",
    "react-hooks/unsupported-syntax": "error",
    "sonarjs/cognitive-complexity": "off",
    "sonarjs/deprecation": "off",
    "sonarjs/prefer-read-only-props": "off",
    "unicorn/filename-case": ["error", { case: "kebabCase" }],
    "unicorn/import-style": ["error", { styles: { path: { default: false, named: true } } }],
    "unicorn/name-replacements": "off",
    "unicorn/no-null": "off",
    "unicorn/single-line-block-comment-style": ["error", "single-line"],
};

const TEST_RULES: Linter.RulesRecord = {
    "@typescript-eslint/unbound-method": "off",
    "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "assert", "expect*"] }],
    "vitest/unbound-method": "error",
};

const restrictAdwImports = (message: string, extra: string[]): Linter.RulesRecord => ({
    "@typescript-eslint/no-restricted-imports": [
        "error",
        {
            paths: ["@gtkx/gi/adw", "@gtkx/jsx/adw", ...extra].map((name) => ({ name, message })),
        },
    ],
});

const scopeTo = (files: string[], configs: (FlatConfig | FlatConfig[])[]): FlatConfig[] =>
    configs.flat().map((entry) => ({ ...entry, files }));

const documentPublicApi = (root: string, surface: PublicApi): FlatConfig => ({
    files: TS_SOURCES,
    ignores: TESTS,
    plugins: { gtkx },
    rules: {
        "gtkx/public-api-jsdoc": [
            "error",
            { entrypoints: surface.entrypoints, modules: surface.modules.map((entry) => entry.path), root },
        ],
    },
});

const classifyEntrypoints = (surface: PublicApi): FlatConfig => ({
    files: MANIFESTS,
    languageOptions: { parser: jsonc },
    plugins: { gtkx },
    rules: { "gtkx/public-entrypoints": ["error", { entrypoints: surface.entrypoints }] },
});

const config = (root: string, surface: PublicApi): FlatConfig[] => [
    includeIgnoreFile(join(root, ".gitignore")),
    { ignores: IGNORES },
    ...scopeTo(SOURCES, SOURCE_EXTENDS),
    {
        files: SOURCES,
        languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
        plugins: { gtkx, perfectionist },
        rules: SOURCE_RULES,
    },
    ...NX_CONFIGS,
    documentPublicApi(root, surface),
    classifyEntrypoints(surface),
    { files: CORE_SOURCES, ignores: ADW_SOURCES, rules: restrictAdwImports(ADW_CORE_MESSAGE, []) },
    {
        files: ["packages/react/src/**/*.{ts,tsx}", "packages/components/src/**/*.{ts,tsx}"],
        ignores: ADW_SOURCES,
        rules: restrictAdwImports(ADW_ENTRYPOINT_MESSAGE, ["@gtkx/react/adw"]),
    },
    {
        files: ["packages/cli/src/vite-plugins/**/*.ts", "packages/runtime/src/properties.ts"],
        rules: { "unicorn/no-this-outside-of-class": "off" },
    },
    {
        files: ["packages/cli/src/**/*.ts", "packages/utils/src/process/**/*.ts"],
        rules: { "unicorn/no-process-exit": "off" },
    },
    {
        files: ["packages/cairo/src/**/*.ts"],
        rules: { "max-params": ["error", { max: 6 }] },
    },
    {
        files: ["packages/cli/src/deploy/**/*.ts", "packages/cli/tests/deploy.test.ts"],
        rules: { "@typescript-eslint/naming-convention": "off" },
    },
    ...scopeTo(TESTS, [vitest.configs.recommended]),
    { files: TESTS, rules: TEST_RULES },
    {
        files: ["packages/cli/tests/dev/supervisor.test.ts"],
        rules: { "unicorn/prefer-event-target": "off" },
    },
    { files: ["**/*.d.ts"], rules: { "@typescript-eslint/consistent-type-definitions": "off" } },
    ...scopeTo(JS_SOURCES, [tseslint.configs.disableTypeChecked]),
    { files: JS_SOURCES },
];

export { config };
