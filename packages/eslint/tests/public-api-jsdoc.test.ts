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
            name: "reports anonymous public members through wrappers and deep nesting",
            code: readFixture("packages/pub/src/anonymous.ts"),
            filename: "packages/pub/src/anonymous.ts",
            options: OPTIONS,
            errors: [
                { messageId: "missingJsDoc", data: { name: "Wrapped" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "Deep" } },
                { messageId: "missingJsDoc", data: { name: "first" } },
                { messageId: "missingJsDoc", data: { name: "second" } },
                { messageId: "missingJsDoc", data: { name: "third" } },
                { messageId: "missingJsDoc", data: { name: "fourth" } },
                { messageId: "missingJsDoc", data: { name: "fifth" } },
                { messageId: "missingJsDoc", data: { name: "sixth" } },
                { messageId: "missingJsDoc", data: { name: "seventh" } },
                { messageId: "missingJsDoc", data: { name: "eighth" } },
                { messageId: "missingJsDoc", data: { name: "ninth" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "Callable" } },
                { messageId: "missingJsDoc", data: { name: "this" } },
                { messageId: "missingJsDoc", data: { name: "this" } },
                { messageId: "missingJsDoc", data: { name: "Recursive" } },
                { messageId: "missingJsDoc", data: { name: "recursive" } },
            ],
        },
        {
            name: "ignores anonymous filters while following public shapes",
            code: readFixture("packages/pub/src/filters.ts"),
            filename: "packages/pub/src/filters.ts",
            options: OPTIONS,
            errors: [
                { messageId: "missingJsDoc", data: { name: "WrappedShape" } },
                { messageId: "missingJsDoc", data: { name: "visible" } },
                { messageId: "missingJsDoc", data: { name: "Variant" } },
                { messageId: "missingJsDoc", data: { name: "kind" } },
                { messageId: "missingJsDoc", data: { name: "selected" } },
                { messageId: "missingJsDoc", data: { name: "kind" } },
                { messageId: "missingJsDoc", data: { name: "other" } },
                { messageId: "missingJsDoc", data: { name: "Selected" } },
                { messageId: "missingJsDoc", data: { name: "Other" } },
                { messageId: "missingJsDoc", data: { name: "GenericSelected" } },
                { messageId: "missingJsDoc", data: { name: "Conditional" } },
                { messageId: "missingJsDoc", data: { name: "visible" } },
            ],
        },
        {
            name: "does not expose declarations used only by private members",
            code: readFixture("packages/pub/src/private-member.ts"),
            filename: "packages/pub/src/private-member.ts",
            options: OPTIONS,
            errors: [
                { messageId: "missingJsDoc", data: { name: "PublicBox" } },
                { messageId: "missingJsDoc", data: { name: "getValue" } },
            ],
        },
        {
            name: "does not expose declarations used only by implementations",
            code: readFixture("packages/pub/src/implementation.ts"),
            filename: "packages/pub/src/implementation.ts",
            options: OPTIONS,
            errors: [{ messageId: "missingJsDoc", data: { name: "publicFunction" } }],
        },
        {
            name: "follows inferred types exposed by public members",
            code: readFixture("packages/pub/src/inferred-member.ts"),
            filename: "packages/pub/src/inferred-member.ts",
            options: OPTIONS,
            errors: [
                { messageId: "missingJsDoc", data: { name: "InternalState" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "PublicContainer" } },
                { messageId: "missingJsDoc", data: { name: "state" } },
                { messageId: "missingJsDoc", data: { name: "WrappedState" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "PublicWrapper" } },
                { messageId: "missingJsDoc", data: { name: "data" } },
                { messageId: "missingJsDoc", data: { name: "ReturnedState" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "createState" } },
                { messageId: "missingJsDoc", data: { name: "SpreadState" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "createSpreadState" } },
                { messageId: "missingJsDoc", data: { name: "AnonymousState" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "createAnonymousState" } },
                { messageId: "missingJsDoc", data: { name: "state" } },
                { messageId: "missingJsDoc", data: { name: "FirstState" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "SecondState" } },
                { messageId: "missingJsDoc", data: { name: "value" } },
                { messageId: "missingJsDoc", data: { name: "first" } },
                { messageId: "missingJsDoc", data: { name: "second" } },
            ],
        },
        {
            name: "reports an overloaded declaration once",
            code: readFixture("packages/pub/src/overload.ts"),
            filename: "packages/pub/src/overload.ts",
            options: OPTIONS,
            errors: [{ messageId: "missingJsDoc", data: { name: "convert" } }],
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
