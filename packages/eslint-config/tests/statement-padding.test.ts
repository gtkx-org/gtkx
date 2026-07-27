import { statementPadding } from "../src/rules/statement-padding.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester();

ruleTester.run("statement-padding", statementPadding, {
    valid: [
        { code: 'import a from "a";\nimport {\n    b,\n} from "b";\nimport c from "c";\n\nconst d = 1;\n' },
        { code: 'const a = 1;\n\nexport { a };\nexport * from "b";\n' },
        { code: "const a = 1;\nconst b = 2;\n" },
        { code: "type A = 1;\n\nconst b = 2;\n" },
        { code: "const a = 1;\n\nconst b = () => 2;\n" },
        { code: "const a = {\n    b: 1,\n};\n\nconst c = 2;\n" },
        { code: "function f() {\n    const a = 1;\n    const b = 2;\n\n    return a + b;\n}\n" },
        { code: "function f() {\n    const a = 1;\n\n    if (a) {\n        g();\n    }\n}\n" },
        { code: "const a = 1;\nconst b = 2;\n\nexport { a, b };\n" },
        { code: "function f() {\n    return 1;\n}\n" },
        { code: "function f() {\n    if (a) return 1;\n\n    return 2;\n}\n" },
        { code: "function f() {\n    if (a) return 1;\n\n    g();\n}\n" },
        { code: "function f() {\n    if (a) g();\n    h();\n}\n" },
        { code: "function f() {\n    if (a) g();\n    else h();\n\n    return 1;\n}\n" },
        { code: "switch (a) {\n    case 1: {\n        g();\n\n        return 1;\n    }\n}\n" },
    ],
    invalid: [
        {
            code: "const a = 1;\n\nconst b = 2;\n",
            output: "const a = 1;\nconst b = 2;\n",
            errors: [{ messageId: "unexpectedPadding" }],
        },
        {
            code: "type A = 1;\nconst b = 2;\n",
            output: "type A = 1;\n\nconst b = 2;\n",
            errors: [{ messageId: "missingPadding", data: { reason: "constants section" } }],
        },
        {
            code: "const a = 1;\nconst b = () => 2;\n",
            output: "const a = 1;\n\nconst b = () => 2;\n",
            errors: [{ messageId: "missingPadding", data: { reason: "functions section" } }],
        },
        {
            code: "const a = {\n    b: 1,\n};\nconst c = 2;\n",
            output: "const a = {\n    b: 1,\n};\n\nconst c = 2;\n",
            errors: [{ messageId: "missingPadding", data: { reason: "multiline statement" } }],
        },
        {
            code: "const a = 1;\n\n\n\nconst b = () => 2;\n",
            output: "const a = 1;\n\nconst b = () => 2;\n",
            errors: [{ messageId: "extraPadding", data: { count: 3 } }],
        },
        {
            code: "function f() {\n    const a = 1;\n\n    const b = 2;\n    return a + b;\n}\n",
            output: "function f() {\n    const a = 1;\n    const b = 2;\n\n    return a + b;\n}\n",
            errors: [
                { messageId: "unexpectedPadding" },
                { messageId: "missingPadding", data: { reason: "return statement" } },
            ],
        },
        {
            code: "function f() {\n    if (a) {\n        g();\n    }\n    return 1;\n}\n",
            output: "function f() {\n    if (a) {\n        g();\n    }\n\n    return 1;\n}\n",
            errors: [{ messageId: "missingPadding", data: { reason: "return statement" } }],
        },
        {
            code: "function f() {\n    const a = 1;\n    return a;\n}\n",
            output: "function f() {\n    const a = 1;\n\n    return a;\n}\n",
            errors: [{ messageId: "missingPadding", data: { reason: "return statement" } }],
        },
        {
            code: "function f() {\n    if (a) return 1;\n    return 2;\n}\n",
            output: "function f() {\n    if (a) return 1;\n\n    return 2;\n}\n",
            errors: [{ messageId: "missingPadding", data: { reason: "return statement" } }],
        },
        {
            code: "switch (a) {\n    case 1: {\n        g();\n        return 1;\n    }\n}\n",
            output: "switch (a) {\n    case 1: {\n        g();\n\n        return 1;\n    }\n}\n",
            errors: [{ messageId: "missingPadding", data: { reason: "return statement" } }],
        },
        {
            code: "function f() {\n    if (a) return 1;\n    g();\n}\n",
            output: "function f() {\n    if (a) return 1;\n\n    g();\n}\n",
            errors: [{ messageId: "missingPadding", data: { reason: "return statement" } }],
        },
        {
            code: "function f() {\n    if (a) return 1;\n    if (b) return 2;\n\n    return 3;\n}\n",
            output: "function f() {\n    if (a) return 1;\n\n    if (b) return 2;\n\n    return 3;\n}\n",
            errors: [{ messageId: "missingPadding", data: { reason: "return statement" } }],
        },
        {
            code: "function f() {\n    if (a) g(); else return 1;\n    h();\n}\n",
            output: "function f() {\n    if (a) g(); else return 1;\n\n    h();\n}\n",
            errors: [{ messageId: "missingPadding", data: { reason: "return statement" } }],
        },
    ],
});
