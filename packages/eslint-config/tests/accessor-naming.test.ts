import { accessorNaming } from "../src/rules/accessor-naming.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester();

ruleTester.run("accessor-naming", accessorNaming, {
    valid: [
        { code: "const getChildren = (node: Node) => node.children;\n" },
        { code: "function getDoc(node: Node) {\n    return node.doc;\n}\n" },
        { code: "const rankFor = (section: Section) => ORDER.indexOf(section);\n" },
        { code: "const waitFor = async (predicate: () => boolean) => {};\n" },
        { code: "const getOrCreateEntry = (state: State, id: string) => state.entries.get(id);\n" },
        { code: "type Signals = { activate: () => void };\n" },
        { code: "type SignalName = string;\n" },
        { code: "const getter = 1;\n" },
        { code: "class Library {\n    typeFor(id: number) {\n        return this.types[id];\n    }\n}\n" },
        { code: "type Docs = {\n    linkFor: (name: string) => string;\n};\n" },
        { code: "const plan = { lengthSources: new Map<number, number>() };\n" },
        { code: "const forwarded = { waitFor };\n" },
    ],
    invalid: [
        {
            code: "const childrenOf = (node: Node) => node.children;\n",
            errors: [{ messageId: "ofSuffix", data: { name: "childrenOf", noun: "Children", stem: "children" } }],
        },
        {
            code: "function docOf(node: Node) {\n    return node.doc;\n}\n",
            errors: [{ messageId: "ofSuffix" }],
        },
        {
            code: "class Library {\n    typeOf(id: number) {\n        return this.types[id];\n    }\n}\n",
            errors: [{ messageId: "ofSuffix" }],
        },
        {
            code: "const model = {\n    positionOf: (id: string) => 0,\n};\n",
            errors: [{ messageId: "ofSuffix" }],
        },
        {
            code: "type Model = {\n    entryOf: (holder: object) => Entry;\n};\n",
            errors: [{ messageId: "ofSuffix" }],
        },
        {
            code: "const getQuarkFor = (signal: string) => 0;\n",
            errors: [{ messageId: "mixedShape", data: { name: "getQuarkFor", suffix: "For" } }],
        },
        {
            code: "function getShaderPrecisionOf(shader: number) {\n    return 0;\n}\n",
            errors: [{ messageId: "mixedShape", data: { name: "getShaderPrecisionOf", suffix: "Of" } }],
        },
        {
            code: "type SignalsOf<T> = T;\n",
            errors: [{ messageId: "typeSuffix", data: { name: "SignalsOf", suffix: "Of" } }],
        },
        {
            code: "type SignalHandlerFor<T> = T;\n",
            errors: [{ messageId: "typeSuffix", data: { name: "SignalHandlerFor", suffix: "For" } }],
        },
        {
            code: "interface EntryOf {\n    signature: string;\n}\n",
            errors: [{ messageId: "typeSuffix" }],
        },
        {
            code: "type Plan = {\n    lengthFor: Map<number, number>;\n};\n",
            errors: [{ messageId: "tableSuffix", data: { name: "lengthFor", suffix: "For" } }],
        },
    ],
});
