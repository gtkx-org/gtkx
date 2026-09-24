import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.numerictables",
    libraries: ["NumericTables-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as GObject from "@gtkx/gi/gobject";
import * as NumericTables from "@gtkx/gi/numerictables";
import { NumericTablesProbe } from "@gtkx/jsx/numerictables";
`;
const ACCEPTED = IMPORTS + `
export const table: NumericTables.TableAlias = new Map([["value", 1n]]);
export const nested: NumericTables.NestedTables = [table];
export const keyAlias: NumericTables.KeyTableAlias = new Map([[1n, 1]]);
export const typeAlias: NumericTables.TypeTableAlias = new Map([["type", 1n]]);
export const scalarType = (type: bigint): bigint => NumericTables.identityType(type);
export const typeWord: NumericTables.TypeWord = GObject.TYPE_FLAG_RESERVED_ID_BIT;
export const typeChain: NumericTables.TypeWordChain = NumericTables.TYPE_WORD_BIT;
export const sizeWord: NumericTables.SizeWord = NumericTables.SIZE_WORD_LIMIT;
export const scalarAliases = () => {
    const direct: NumericTables.TypeWord = NumericTables.identityTypeWord(typeWord);
    const chain: NumericTables.TypeWordChain = NumericTables.identityTypeWordChain(typeChain);
    const size: NumericTables.SizeWord = NumericTables.identitySizeWord(sizeWord);
    const builtin: GObject.Type = GObject.typeFromName("GObject");
    return { direct, chain, size, builtin };
};
export const doubleKeys = (): Map<number, number> => NumericTables.readDoubleKeys();
export const frame = new NumericTables.Frame({ before: 1, after: 2 });
export const neighbors = (value: NumericTables.Frame): number => value.before + value.after;
export const probe = new NumericTables.Probe({ count: 1, typeWord, chainWord: typeChain, sizeWord });
export const view = <NumericTablesProbe count={1} typeWord={1n} chainWord={1n} sizeWord={8} onChanged={(count) => {
    const value: number = count; void value;
}} />;
probe.on("changed", (count) => { const value: number = count; void value; });
export const signed: NumericTables.SignedCell = -1n;
export const unsigned: NumericTables.UnsignedCell = 1n;
export const float: NumericTables.FloatCell = 1.5;
export const properties = (value: NumericTables.Probe) => {
    value.typeWord = typeWord;
    value.chainWord = typeChain;
    value.sizeWord = sizeWord;
    const direct: bigint = value.typeWord;
    const chain: bigint = value.chainWord;
    const size: number = value.sizeWord;
    return { direct, chain, size };
};
export const read = () => {
    const direct: Map<string, bigint> = NumericTables.readFull();
    const output: Map<string, bigint> = NumericTables.readOut();
    const nested: Map<string, Map<string, bigint>> = NumericTables.readNested();
    return { direct, output, nested };
};
export const write = (probe: NumericTables.Probe, key: NumericTables.Key) => {
    NumericTables.takeBorrowed(table);
    NumericTables.takeSignedBorrowed(new Map([["value", signed]]));
    NumericTables.takeWords(new Map([[1, -1]]));
    NumericTables.takeEnum(new Map([[key, "value"]]));
    probe.takeBorrowed(table);
};
export const input: NumericTables.OwnedInput = (received) => {
    const value: Map<string, bigint> = received;
    void value;
};
export const withData: NumericTables.OwnedInputWithData = (received) => { void received; };
export const borrowedReturn: NumericTables.BorrowedReturn = () => table;
export const callbacks = () => {
    NumericTables.useOwnedInput(input);
    NumericTables.useBorrowedReturn(borrowedReturn);
};
export class Derived extends NumericTables.Probe {
    readCount(): number { return this.vfuncCount(); }
    forward(table: NumericTables.TableAlias): void { this.vfuncBorrowedInput(table); }
    decoded(): void {
        this.vfuncDecodedBorrowed((table) => {
            const value: Map<string, bigint> = table;
            void value;
        });
    }
}
`;
const REJECTED: Record<string, string> = {
    "type-word-key-input": "export const method = NumericTables.takeTypeWordKeys;",
    "type-word-value-input": "export const method = NumericTables.takeTypeWordAlias;",
    "type-word-chain-result": "export const method = NumericTables.readTypeWordChain;",
    "type-word-argument": "NumericTables.identityTypeWord(1);",
    "type-chain-argument": "NumericTables.identityTypeWordChain(1);",
    "size-word-argument": "NumericTables.identitySizeWord(1n);",
    "type-word-option": "export const probe = new NumericTables.Probe({ typeWord: 1 });",
    "size-word-option": "export const probe = new NumericTables.Probe({ sizeWord: 1n });",
    "type-word-jsx": "export const view = <NumericTablesProbe typeWord={1} />;",
    "type-chain-jsx": "export const view = <NumericTablesProbe chainWord={1} />;",
    "size-word-jsx": "export const view = <NumericTablesProbe sizeWord={1n} />;",
    "borrowed-key-input": "export const method = NumericTables.takeKeyBorrowed;",
    "signed-key-result": "export const method = NumericTables.readSignedKeys;",
    "gtype-key-result": "export const method = NumericTables.readTypeKeys;",
    "key-out-result": "export const method = NumericTables.readKeyOut;",
    "nested-key-result": "export const method = NumericTables.readKeyArrays;",
    "key-input-callback": "export type Callback = NumericTables.KeyInput;",
    "key-return-callback": "export type Callback = NumericTables.KeyReturn;",
    "key-output-callback": "export type Callback = NumericTables.KeyOutput;",
    "key-callback-consumer": "export const method = NumericTables.useKeyInput;",
    "key-property-read": "export const read = (probe: NumericTables.Probe) => probe.keyed;",
    "key-property-option": "export const probe = new NumericTables.Probe({ keyed: new Map() });",
    "key-property-jsx": "export const view = <NumericTablesProbe keyed={new Map()} />;",
    "key-property-notify": "export const view = <NumericTablesProbe onNotifyKeyed={() => undefined} />;",
    "key-signal": 'export const listen = (probe: NumericTables.Probe) => probe.on("keyed", () => undefined);',
    "key-signal-jsx": "export const view = <NumericTablesProbe onKeyed={() => undefined} />;",
    "key-field-read": "export const read = (frame: NumericTables.Frame) => frame.keyed;",
    "key-field-option": "export const frame = new NumericTables.Frame({ keyed: new Map() });",
    "key-vfunc-input": `export class Derived extends NumericTables.Probe {
        override vfuncKeyInput(_table: NumericTables.KeyTableAlias): void {}
    }`,
    "key-vfunc-result": `export class Derived extends NumericTables.Probe {
        override vfuncKeyResult(): NumericTables.KeyTableAlias { return new Map(); }
    }`,
    "borrowed-type-value-input": "export const method = NumericTables.takeTypeBorrowed;",
    "direct-type-value-result": "export const method = NumericTables.readTypes;",
    "nested-type-value-result": "export const method = NumericTables.readNestedTypes;",
    "type-value-out-result": "export const method = NumericTables.readTypeOut;",
    "array-type-value-result": "export const method = NumericTables.readTypeArrays;",
    "type-value-input-callback": "export type Callback = NumericTables.TypeInput;",
    "type-value-return-callback": "export type Callback = NumericTables.TypeReturn;",
    "type-value-output-callback": "export type Callback = NumericTables.TypeOutput;",
    "type-value-callback-consumer": "export const method = NumericTables.useTypeInput;",
    "type-value-property-read": "export const read = (probe: NumericTables.Probe) => probe.typed;",
    "type-value-property-option": "export const probe = new NumericTables.Probe({ typed: new Map() });",
    "type-value-property-jsx": "export const view = <NumericTablesProbe typed={{ type: 1n }} />;",
    "type-value-property-notify": "export const view = <NumericTablesProbe onNotifyTyped={() => undefined} />;",
    "type-value-signal": 'export const listen = (probe: NumericTables.Probe) => probe.on("typed", () => undefined);',
    "type-value-signal-jsx": "export const view = <NumericTablesProbe onTyped={() => undefined} />;",
    "type-value-field-read": "export const read = (frame: NumericTables.Frame) => frame.typed;",
    "type-value-field-option": "export const frame = new NumericTables.Frame({ typed: new Map() });",
    "type-value-vfunc-input": `export class Derived extends NumericTables.Probe {
        override vfuncTypeInput(_table: NumericTables.TypeTableAlias): void {}
    }`,
    "type-value-vfunc-result": `export class Derived extends NumericTables.Probe {
        override vfuncTypeResult(): NumericTables.TypeTableAlias { return new Map(); }
    }`,
    "full-input": "export const method = NumericTables.takeFull;",
    "container-input": "export const method = NumericTables.takeContainer;",
    "numeric-key": "export const method = NumericTables.takeKey;",
    "gtype-cell": "export const method = NumericTables.takeType;",
    "nested-full-input": "export const method = NumericTables.takeNestedFull;",
    "class-input": 'export type Method = NumericTables.Probe["takeFull"];',
    "owned-return-callback": "export type Callback = NumericTables.OwnedReturn;",
    "container-return-callback": "export type Callback = NumericTables.ContainerReturn;",
    "owned-output-callback": "export type Callback = NumericTables.OwnedOutput;",
    "owned-inout-callback": "export type Callback = NumericTables.OwnedInout;",
    "callback-alias": "export type Callback = NumericTables.OwnedReturnAlias;",
    "return-callback-consumer": "export const method = NumericTables.useOwnedReturn;",
    "output-callback-consumer": "export const method = NumericTables.useOwnedOutput;",
    "vfunc-input": `export class Derived extends NumericTables.Probe {
        override vfuncOwnedInput(_table: NumericTables.TableAlias): void {}
    }`,
    "vfunc-result": `export class Derived extends NumericTables.Probe {
        override vfuncOwnedResult(): NumericTables.TableAlias { return new Map(); }
    }`,
    "vfunc-output": `export class Derived extends NumericTables.Probe {
        override vfuncOwnedOutput(): NumericTables.TableAlias { return new Map(); }
    }`,
    "decoded-callback-input": `export class Derived extends NumericTables.Probe {
        override vfuncDecodedOwned(_operation: NumericTables.OwnedInputWithData): void {}
    }`,
    "callback-result-type": 'export const callback: NumericTables.BorrowedReturn = () => "invalid";',
    "table-value-type": 'NumericTables.takeBorrowed(new Map([["value", 1]]));',
};
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.tsx`, IMPORTS + source,
]));
const OMITTED_FUNCTIONS = [
    "takeTypeWordKeys", "takeTypeWordAlias", "readTypeWordChain",
    "takeTypeBorrowed", "readTypes", "readNestedTypes", "readTypeOut", "readTypeArrays", "useTypeInput",
    "takeFull", "takeContainer", "takeKey", "takeType", "takeNestedFull", "useOwnedReturn", "useOwnedOutput",
    "takeKeyBorrowed", "readSignedKeys", "readTypeKeys", "readKeyOut", "readKeyArrays", "useKeyInput",
];
const OMITTED_CALLBACKS = [
    "TypeInput", "TypeReturn", "TypeOutput",
    "OwnedReturn", "ContainerReturn", "OwnedOutput", "OwnedInout", "KeyInput", "KeyReturn", "KeyOutput",
];
const OMITTED_MEMBERS = [
    "takeFull", "vfuncOwnedInput", "vfuncOwnedResult", "vfuncOwnedOutput", "vfuncDecodedOwned",
    "keyed", "vfuncKeyInput", "vfuncKeyResult", "typed", "vfuncTypeInput", "vfuncTypeResult",
];

describe("generated numeric hash table ownership admission", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;
    let reference: ReturnType<typeof loadApiReference>;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/NumericTables-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-hash-table-admission-",
            config: CONFIG,
            files: { "gir/NumericTables-1.0.gir": fixture, "accepted.tsx": ACCEPTED, ...rejectedFiles },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
        reference = loadApiReference({
            libraries: ["NumericTables-1.0", "Gtk-4.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves borrowed inputs, decoded outputs and semantic scalar aliases", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the unsupported public contract in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });

    it("keeps namespace and callback reference entries aligned with declarations", () => {
        for (const name of OMITTED_FUNCTIONS) {
            expect(reference.lookup(`NumericTables.${name}`, "function").outcome).toBe("notFound");
        }
        for (const name of [
            "takeBorrowed", "takeWords", "readFull", "readOut", "readNested", "useOwnedInput",
            "readDoubleKeys", "identityType", "identityTypeWord", "identityTypeWordChain", "identitySizeWord",
        ]) {
            expect(reference.lookup(`NumericTables.${name}`, "function").outcome).toBe("page");
        }
        for (const name of OMITTED_CALLBACKS) {
            expect(reference.lookup(`NumericTables.${name}`, "callback").outcome).toBe("notFound");
        }
        expect(reference.lookup("NumericTables.OwnedReturnAlias", "alias").outcome).toBe("notFound");
        for (const name of [
            "Table", "TableAlias", "NestedTables", "SignedCell", "TypeWord", "KeyTable", "KeyTableAlias",
            "TypeId", "TypeTable", "TypeTableAlias", "TypeWordChain", "SizeWord",
        ]) {
            expect(reference.lookup(`NumericTables.${name}`, "alias").outcome).toBe("page");
        }
        for (const name of ["OwnedInput", "OwnedInputWithData", "BorrowedReturn"]) {
            expect(reference.lookup(`NumericTables.${name}`, "callback").outcome).toBe("page");
        }
    });

    it("documents canonical scalar aliases without recursive GObject types", () => {
        for (const name of ["TypeWord", "TypeWordChain"]) {
            const alias = reference.lookup(`NumericTables.${name}`, "alias");
            expect(alias.outcome).toBe("page");
            expect(alias).toHaveProperty("markdown", expect.stringContaining(`type ${name} = bigint`));
        }
        const size = reference.lookup("NumericTables.SizeWord", "alias");
        const type = reference.lookup("GObject.Type", "alias");
        expect(size.outcome).toBe("page");
        expect(type.outcome).toBe("page");
        expect(size).toHaveProperty("markdown", expect.stringContaining("type SizeWord = number"));
        expect(type).toHaveProperty("markdown", expect.stringContaining("type Type = bigint"));
    });

    it("omits unsupported record fields and element props while keeping typed controls", () => {
        const frame = reference.lookup("NumericTables.Frame", "record");
        const element = reference.lookup("NumericTablesProbe", "element");
        expect(frame.outcome).toBe("page");
        expect(element.outcome).toBe("page");
        for (const name of ["before", "after"]) {
            expect(frame).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of ["keyed", "typed"]) {
            expect(frame).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        for (const name of ["count", "typeWord", "chainWord", "sizeWord"]) {
            expect(element).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        expect(element).toHaveProperty("markdown", expect.stringContaining("### `onChanged`"));
        for (const name of ["keyed", "onKeyed", "typed", "onTyped"]) {
            expect(element).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
    });

    it("keeps class reference entries aligned with callable roles", () => {
        const probe = reference.lookup("NumericTables.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of ["takeBorrowed", "vfuncCount", "vfuncBorrowedInput", "vfuncDecodedBorrowed"]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of OMITTED_MEMBERS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
    });
});
