import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SurfaceOptions } from "../src/rules/public-surface.js";
import { publicApiJsdoc } from "../src/rules/public-api-jsdoc.js";
import { createRuleTester } from "./rule-tester.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const OPTIONS: [SurfaceOptions] = [{ entrypoints: ["@fixture/pub"], modules: [], root: FIXTURES }];

const ruleTester = createRuleTester({
    languageOptions: {
        parserOptions: { projectService: false, project: "./tsconfig.json", tsconfigRootDir: FIXTURES },
    },
});

const readFixture = (path: string): string => readFileSync(join(FIXTURES, path), "utf8");

ruleTester.run("public-api-jsdoc", publicApiJsdoc, {
    valid: [
        {
            name: "documents every declaration reachable from a public entrypoint",
            code: readFixture("packages/pub/src/documented.ts"),
            filename: "packages/pub/src/documented.ts",
            options: OPTIONS,
        },
        {
            name: "leaves a barrel of re-exports alone",
            code: readFixture("packages/pub/src/index.ts"),
            filename: "packages/pub/src/index.ts",
            options: OPTIONS,
        },
    ],
    invalid: [
        {
            name: "reports a public declaration and its member with no JSDoc",
            code: readFixture("packages/pub/src/widget.ts"),
            filename: "packages/pub/src/widget.ts",
            options: OPTIONS,
            errors: [
                { messageId: "missingJsDoc", data: { name: "Widget" } },
                { messageId: "missingJsDoc", data: { name: "label" } },
                { messageId: "missingJsDoc", data: { name: "makeWidget" } },
            ],
        },
        {
            name: "reports JSDoc on a declaration reachable only from an internal entrypoint",
            code: readFixture("packages/pub/src/internal.ts"),
            filename: "packages/pub/src/internal.ts",
            options: OPTIONS,
            errors: [{ messageId: "privateJsDoc", data: { name: "Cache" } }],
        },
        {
            name: "reports JSDoc in a package that is never published",
            code: readFixture("packages/priv/src/index.ts"),
            filename: "packages/priv/src/index.ts",
            options: OPTIONS,
            errors: [{ messageId: "privateJsDoc", data: { name: "Hidden" } }],
        },
    ],
});
