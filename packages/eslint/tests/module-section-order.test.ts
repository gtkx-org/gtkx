import { moduleSectionOrder } from "../src/rules/module-section-order.js";
import { createRuleTester } from "./rule-tester.js";

const ordered = `
import { join } from "node:path";

type Options = { root: string };

const DEFAULT_ROOT = "/";

let cached: string | undefined;

const resolveRoot = (options: Options): string => options.root ?? DEFAULT_ROOT;

function warm(options: Options): void {
    cached = resolveRoot(options);
}

class Loader {
    load(): string {
        return cached ?? join(DEFAULT_ROOT, "x");
    }
}

warm({ root: DEFAULT_ROOT });

export { Loader, resolveRoot };
`;

const ruleTester = createRuleTester();

ruleTester.run("module-section-order", moduleSectionOrder, {
    valid: [
        { code: ordered },
        { code: "const A = 1;\nconst b = () => A;\n" },
        { code: "export const A = 1;\nexport function b() { return A; }\n" },
        { code: "export default 1;\nconst A = 1;\n" },
        { code: "declare module \"x\" {}\nconst A = 1;\n" },
        { code: "import \"./side-effect.js\";\nconst A = 1;\n" },
    ],
    invalid: [
        {
            code: "const a = () => 1;\nconst B = 2;\n",
            errors: [{ messageId: "outOfOrder", data: { section: "constants", blocker: "functions", line: 1 } }],
        },
        {
            code: "class A {}\nfunction b() {}\n",
            errors: [{ messageId: "outOfOrder", data: { section: "functions", blocker: "classes", line: 1 } }],
        },
        {
            code: "export { a };\nconst a = 1;\n",
            errors: [{ messageId: "outOfOrder", data: { section: "constants", blocker: "exports", line: 1 } }],
        },
        {
            code: "doSomething();\ntype A = 1;\nconst b = 2;\n",
            errors: [
                { messageId: "outOfOrder", data: { section: "types", blocker: "side effects", line: 1 } },
                { messageId: "outOfOrder", data: { section: "constants", blocker: "side effects", line: 1 } },
            ],
        },
        {
            code: "const a = 1;\nimport { b } from \"b\";\n",
            errors: [{ messageId: "outOfOrder", data: { section: "imports", blocker: "constants", line: 1 } }],
        },
    ],
});
