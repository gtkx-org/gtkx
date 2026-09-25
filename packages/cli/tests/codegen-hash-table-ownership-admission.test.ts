import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import { createHashTableAdmissionProject } from "./codegen-hash-table-admission-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED: Record<string, string> = {
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

describe("generated numeric hash table ownership admission", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = createHashTableAdmissionProject(cleanup, "gtkx-cli-hash-table-ownership-admission-", REJECTED);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(Object.keys(REJECTED))("rejects the unsupported public contract in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });
});
