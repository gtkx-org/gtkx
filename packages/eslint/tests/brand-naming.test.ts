import { brandNaming } from "../src/rules/brand-naming.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester();

ruleTester.run("brand-naming", brandNaming, {
    valid: [
        { code: "type A = {\n    __impl__: never;\n};\n" },
        { code: "type B = {\n    __type__: bigint;\n};\n" },
        { code: "class C {\n    declare static __impl__: never;\n}\n" },
        { code: "type A = {\n    $RefreshReg$: () => void;\n};\n" },
        { code: "type B = {\n    $RefreshSig$: () => void;\n};\n" },
        { code: "const REFRESH_REG = \"$RefreshReg$\";\n" },
        { code: "const ns = \"$internal\";\n" },
        { code: "type D = {\n    [key: string]: unknown;\n};\n" },
    ],
    invalid: [
        {
            code: "type A = {\n    $impl: never;\n};\n",
            errors: [{ messageId: "dollarBrand", data: { name: "$impl", brand: "__impl__" } }],
        },
        {
            code: "class C {\n    declare static $impl: never;\n}\n",
            errors: [{ messageId: "dollarBrand", data: { name: "$impl", brand: "__impl__" } }],
        },
        {
            code: "interface I {\n    $tag(): void;\n}\n",
            errors: [{ messageId: "dollarBrand", data: { name: "$tag", brand: "__tag__" } }],
        },
    ],
});
