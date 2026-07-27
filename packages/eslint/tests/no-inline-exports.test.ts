import { noInlineExports } from "../src/rules/no-inline-exports.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester();

ruleTester.run("no-inline-exports", noInlineExports, {
    valid: [
        { code: "const a = 1;\n\nexport { a };\n" },
        { code: "export * from \"./x.js\";\n" },
        { code: "export { a } from \"./x.js\";\n" },
        { code: "export type { A } from \"./x.js\";\n" },
        { code: "const a = 1;\n\nexport default a;\n" },
        { code: "declare module \"x\" {\n    export type A = 1;\n}\n" },
        { code: "function f() {\n    return 1;\n}\n\nexport { f };\n" },
    ],
    invalid: [
        {
            code: "export const a = 1;\n",
            errors: [{ messageId: "inlineExport", data: { names: "a", list: "`export { a };`" } }],
        },
        {
            code: "export function f() {}\n",
            errors: [{ messageId: "inlineExport", data: { names: "f", list: "`export { f };`" } }],
        },
        {
            code: "export class C {}\n",
            errors: [{ messageId: "inlineExport", data: { names: "C", list: "`export { C };`" } }],
        },
        {
            code: "export type A = 1;\n",
            errors: [{ messageId: "inlineExport", data: { names: "A", list: "`export { A };`" } }],
        },
        {
            code: "export interface I {\n    a: 1;\n}\n",
            errors: [{ messageId: "inlineExport", data: { names: "I", list: "`export { I };`" } }],
        },
        {
            code: "export const a = 1, b = 2;\n",
            errors: [{ messageId: "inlineExport", data: { names: "a, b", list: "`export { a, b };`" } }],
        },
    ],
});
