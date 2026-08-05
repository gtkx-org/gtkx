import * as jsonc from "jsonc-eslint-parser";
import { publicEntrypoints } from "../src/rules/public-entrypoints.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester({ languageOptions: { parser: jsonc } });

const manifest = (body: string): string => `${body}\n`;

ruleTester.run("public-entrypoints", publicEntrypoints, {
    valid: [
        {
            name: "every listed entrypoint resolves",
            code: manifest("{ \"name\": \"@a/b\", \"exports\": { \".\": \"./src/index.ts\" } }"),
            filename: "packages/b/package.json",
            options: [{ entrypoints: ["@a/b"] }],
        },
        {
            name: "a subpath entrypoint resolves",
            code: manifest("{ \"name\": \"@a/b\", \"exports\": { \"./cfg\": \"./src/cfg.ts\" } }"),
            filename: "packages/b/package.json",
            options: [{ entrypoints: ["@a/b/cfg"] }],
        },
        {
            name: "unlisted subpaths need no entry",
            code: manifest("{ \"name\": \"@a/b\", \"exports\": { \".\": \"./i.ts\", \"./internal\": \"./n.ts\" } }"),
            filename: "packages/b/package.json",
            options: [{ entrypoints: ["@a/b"] }],
        },
        {
            name: "another package's entrypoints are ignored",
            code: manifest("{ \"name\": \"@a/b\", \"exports\": { \".\": \"./src/index.ts\" } }"),
            filename: "packages/b/package.json",
            options: [{ entrypoints: ["@a/b", "@a/c"] }],
        },
    ],
    invalid: [
        {
            name: "a listed entrypoint that the package does not export",
            code: manifest("{ \"name\": \"@a/b\", \"exports\": { \".\": \"./src/index.ts\" } }"),
            filename: "packages/b/package.json",
            options: [{ entrypoints: ["@a/b", "@a/b/cfg"] }],
            errors: [{ messageId: "missingEntrypoint", data: { specifier: "@a/b/cfg", subpath: "./cfg" } }],
        },
        {
            name: "a listed entrypoint on a package that never ships",
            code: manifest("{ \"name\": \"@a/b\", \"private\": true, \"exports\": { \".\": \"./src/index.ts\" } }"),
            filename: "packages/b/package.json",
            options: [{ entrypoints: ["@a/b"] }],
            errors: [{ messageId: "privatePackage", data: { specifier: "@a/b" } }],
        },
    ],
});
