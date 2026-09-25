import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import { createHashTableAdmissionProject } from "./codegen-hash-table-admission-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED: Record<string, string> = {
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

describe("generated numeric hash table type admission", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = createHashTableAdmissionProject(cleanup, "gtkx-cli-hash-table-type-admission-", REJECTED);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(Object.keys(REJECTED))("rejects the unsupported public contract in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });
});
