import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { generatedModule } from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.inlinerecordarrays",
    libraries: ["InlineRecordArrays-1.0", "Gio-2.0", "HarfBuzz-0.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;

const ACCEPTED = `import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";

export const borrow = InlineRecordArrays.borrowValues;
export const borrowSlots = InlineRecordArrays.borrowStringSlots;
export const borrowed = InlineRecordArrays.borrowedValues;
export const containerValues = InlineRecordArrays.returnContainerValues;
export const values = InlineRecordArrays.returnValueArray;
export const pure = InlineRecordArrays.returnPure;
export const takePure = InlineRecordArrays.takePure;
export const lent: InlineRecordArrays.LentStringSlots = (slots) => InlineRecordArrays.borrowStringSlots(slots);
export const returnPure: InlineRecordArrays.ReturnPure = () => [
    new InlineRecordArrays.Pure(),
    new InlineRecordArrays.Pure(),
];
export const enumValues = (typeClass: GObject.EnumClass): GObject.EnumValue[] => typeClass.values;
export type TransferredCallback = InlineRecordArrays.TakeValueArray;
export type Values = GObject.Value[];
export type WritevVfunc = Gio.OutputStream["vfuncWritevAsync"];
`;

const REJECTED: Record<string, string> = {
    "async-values": `import * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export const value = InlineRecordArrays.borrowValuesAsync;
`,
    "borrowed-owner": `import * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export const value = InlineRecordArrays.borrowedStringSlots;
`,
    "caller-values": `import * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export const value = InlineRecordArrays.fillValues;
`,
    "full-array-input": `import * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export const value = InlineRecordArrays.takeValueArray;
`,
    "full-flat-input": `import * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export const value = InlineRecordArrays.takeValues;
`,
    "full-flat-output": `import * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export const value = InlineRecordArrays.returnValues;
`,
    "gio-async": `import type * as Gio from "@gtkx/gi/gio";
export type Value = Gio.OutputStream["writevAsync"];
`,
    "harfbuzz-owner": `import * as HarfBuzz from "@gtkx/gi/harfbuzz";
export const value = HarfBuzz.otNameListNames;
`,
    "resource-return-callback": `import type * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export type Value = InlineRecordArrays.ReturnStringSlots;
`,
    "resource-field-array-write": `import type * as GObject from "@gtkx/gi/gobject";
export const update = (typeClass: GObject.EnumClass): void => { typeClass.values = typeClass.values; };
`,
    "retained-borrowed-return-callback": `import type * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export type Value = InlineRecordArrays.ReturnBorrowedValues;
`,
    "retained-borrowed-out-callback": `import type * as InlineRecordArrays from "@gtkx/gi/inlinerecordarrays";
export type Value = InlineRecordArrays.FillBorrowedValues;
`,
};

const REJECTED_FILES = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [`${name}.ts`, source]));

describe("generated inline record array admission", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/InlineRecordArrays-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-inline-record-arrays-",
            config: CONFIG,
            files: { "gir/InlineRecordArrays-1.0.gir": fixture, "accepted.ts": ACCEPTED, ...REJECTED_FILES },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves borrowed inputs, owned copies, value records, callbacks and vfunc inputs", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("omits the unsafe public shape %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });

    it("omits unsafe native bindings while keeping the safe controls", () => {
        const source = generatedModule(project, "gi", "inlinerecordarrays", "inlinerecordarrays.js");
        for (const symbol of [
            "inline_record_arrays_borrow_values_async",
            "inline_record_arrays_borrowed_string_slots",
            "inline_record_arrays_fill_values",
            "inline_record_arrays_return_values",
            "inline_record_arrays_take_value_array",
            "inline_record_arrays_take_values",
        ]) {
            expect(source).not.toContain(symbol);
        }
        for (const symbol of [
            "inline_record_arrays_borrow_string_slots",
            "inline_record_arrays_borrow_values",
            "inline_record_arrays_borrowed_values",
            "inline_record_arrays_return_container_values",
            "inline_record_arrays_return_pure",
            "inline_record_arrays_return_value_array",
            "inline_record_arrays_take_pure",
        ]) {
            expect(source).toContain(symbol);
        }
    });

    it("keeps callback-lent Gio vectors while omitting async calls and owner-bound HarfBuzz records", () => {
        const gio = generatedModule(project, "gi", "gio", "gio.d.ts");
        const harfbuzz = generatedModule(project, "gi", "harfbuzz", "harfbuzz.d.ts");

        expect(gio).toContain("vfuncWritevAsync(");
        expect(gio).not.toContain("writevAllAsync(");
        expect(gio).not.toContain("writevAsync(");
        expect(harfbuzz).not.toContain("otNameListNames(");
    });
});
