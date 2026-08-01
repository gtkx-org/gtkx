import { booleanName } from "../src/rules/boolean-name.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester();

ruleTester.run("boolean-name", booleanName, {
    valid: [
        { code: "type Options = {\n    isVisible: boolean;\n};\n" },
        { code: "type Options = {\n    hasChildren: boolean;\n};\n" },
        { code: "type Options = {\n    requiresVirtualSeat: boolean;\n};\n" },
        { code: "type Options = {\n    isVisible: boolean | undefined;\n};\n" },
        { code: "type Options = {\n    isMatch: () => boolean;\n};\n" },
        { code: "type Options = {\n    matches: () => boolean;\n};\n" },
        { code: "type Options = {\n    onKeyPressed: (key: number) => boolean;\n};\n" },
        { code: "type Options = {\n    name: string;\n};\n" },
        { code: "type Options = {\n    pending: Promise<void>;\n};\n" },
        { code: "type Options = {\n    value: boolean | string;\n};\n" },
        { code: "class Root {\n    private isOpen: boolean = false;\n}\n" },
        { code: "class Root {\n    open = false;\n}\n" },
        { code: "const isReady = true;\n" },
        { code: "const isReady = value === 1;\n" },
        { code: "const isReady = !value;\n" },
        { code: "const count = 1;\n" },
        { code: "const entry = items.get(id);\n" },
        { code: "let isReady: boolean | undefined;\n" },
        {
            code: "type GirClass = {\n    throws: boolean;\n};\n",
            options: [{ mirrors: ["GirClass"] }],
        },
        {
            code: "interface GirClass {\n    throws: boolean;\n}\n",
            options: [{ mirrors: ["GirClass"] }],
        },
        {
            code: "type Manifest = {\n    private: boolean;\n};\n",
            options: [{ mirrorProperties: ["private"] }],
        },
    ],
    invalid: [
        {
            code: "type Options = {\n    visible: boolean;\n};\n",
            errors: [{ messageId: "missingPrefix" }],
        },
        {
            code: "type Options = {\n    visible: boolean | undefined;\n};\n",
            errors: [{ messageId: "missingPrefix" }],
        },
        {
            code: "class Root {\n    open: boolean = false;\n}\n",
            errors: [{ messageId: "missingPrefix" }],
        },
        {
            code: "const ready = true;\n",
            errors: [{ messageId: "missingPrefix" }],
        },
        {
            code: "const ready = value === 1;\n",
            errors: [{ messageId: "missingPrefix" }],
        },
        {
            code: "type Options = {\n    isName: string;\n};\n",
            errors: [{ messageId: "notBoolean", data: { name: "isName", shape: "a non-boolean value" } }],
        },
        {
            code: "type Options = {\n    isCount: number | string;\n};\n",
            errors: [{ messageId: "notBoolean" }],
        },
        {
            code: "const hasEntry = 1;\n",
            errors: [{ messageId: "notBoolean" }],
        },
        {
            code: "type Options = {\n    notReady: boolean;\n};\n",
            errors: [{ messageId: "negated", data: { name: "notReady" } }],
        },
        {
            code: "type Options = {\n    skipSelf: boolean;\n};\n",
            errors: [{ messageId: "negated" }],
        },
        {
            code: "const disableCache: boolean = true;\n",
            errors: [{ messageId: "negated" }],
        },
        {
            code: "type Options = {\n    visible: boolean;\n};\n",
            options: [{ mirrors: ["GirClass"], mirrorProperties: ["private"] }],
            errors: [{ messageId: "missingPrefix" }],
        },
    ],
});
