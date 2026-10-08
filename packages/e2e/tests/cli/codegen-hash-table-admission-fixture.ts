import { readFileSync } from "node:fs";
import type { CliProject } from "./cli-project.js";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.numerictables",
    libraries: ["NumericTables-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const HASH_TABLE_IMPORTS = `import * as GObject from "@gtkx/gi/gobject";
import * as NumericTables from "@gtkx/gi/numerictables";
import { NumericTablesProbe } from "@gtkx/jsx/numerictables";
`;

const HASH_TABLE_REJECTED: Record<string, string> = {
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
};

const rejectedFiles = (rejected: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(rejected).map(([name, source]) => [
        `${name}.tsx`, HASH_TABLE_IMPORTS + source,
    ]));

const createHashTableAdmissionProject = (
    cleanup: DisposableStack,
    prefix: string,
    rejected: Record<string, string>,
    files: Record<string, string> = {},
): CliProject => {
    const fixture = readFileSync(new URL("fixtures/gir/NumericTables-1.0.gir", import.meta.url));
    const project = cleanup.use(createCliProject({
        prefix,
        config: CONFIG,
        files: { "gir/NumericTables-1.0.gir": fixture, ...files, ...rejectedFiles(rejected) },
    }));
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);

    return project;
};

export { createHashTableAdmissionProject, HASH_TABLE_IMPORTS, HASH_TABLE_REJECTED };
