import { noComments } from "../src/rules/no-comments.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester({ linterOptions: { reportUnusedDisableDirectives: false } });

ruleTester.run("no-comments", noComments, {
    valid: [
        { code: "/** Builds a widget. */\nfunction make() {}\n" },
        { code: "/**\n * Builds a widget.\n */\nfunction make() {}\n" },
        { code: "/// <reference types=\"vite/client\" />\n" },
        { code: "// eslint-disable-next-line no-console\nconsole.log(1);\n" },
        { code: "/* eslint-disable */\nconst a = 1;\n" },
        { code: "// @ts-expect-error deliberate\nconst a: number = \"x\";\n" },
        { code: "const a = import(/* @vite-ignore */ path);\n" },
        { code: "#!/usr/bin/env node\nconst a = 1;\n" },
        { code: "// v8 ignore next\nconst a = 1;\n" },
        { code: "const a = 1;\n" },
    ],
    invalid: [
        { code: "// explains the trick\nconst a = 1;\n", errors: [{ messageId: "prohibitedComment" }] },
        { code: "const a = 1; // inline note\n", errors: [{ messageId: "prohibitedComment" }] },
        { code: "/* block note */\nconst a = 1;\n", errors: [{ messageId: "prohibitedComment" }] },
        {
            code: "/*\n * A multiline note.\n */\nconst a = 1;\n",
            errors: [{ messageId: "prohibitedComment" }],
        },
        {
            code: "// first\n// second\nconst a = 1;\n",
            errors: [{ messageId: "prohibitedComment" }, { messageId: "prohibitedComment" }],
        },
    ],
});
