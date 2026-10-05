import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import { createHashTableAdmissionProject } from "./codegen-hash-table-admission-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED: Record<string, string> = {
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
};

describe("generated numeric hash table key admission", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = createHashTableAdmissionProject(cleanup, "gtkx-cli-hash-table-key-admission-", REJECTED);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(Object.keys(REJECTED))("rejects the unsupported public contract in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });
});
