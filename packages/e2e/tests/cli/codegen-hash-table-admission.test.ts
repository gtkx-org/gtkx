import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import { createHashTableAdmissionProject, HASH_TABLE_IMPORTS } from "./codegen-hash-table-admission-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const ACCEPTED = HASH_TABLE_IMPORTS + `
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
export const updateFrame = (frame: NumericTables.Frame): void => {
    frame.before = 1;
    frame.after = 2;
};
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
    "pointer-record-constructor": "export const frame = new NumericTables.Frame({ before: 1, after: 2 });",
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
};
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
        project = createHashTableAdmissionProject(
            cleanup,
            "gtkx-cli-hash-table-admission-",
            REJECTED,
            { "accepted.tsx": ACCEPTED },
        );
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
