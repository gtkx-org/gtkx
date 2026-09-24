import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.callbackindirection",
    libraries: ["CallbackIndirection-1.0"], girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as Fixture from "@gtkx/gi/callbackindirection";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
`;
const ACCEPTED = IMPORTS + `
export const inplace: Fixture.InPlace = (cell) => { cell.value += 1; };
export const aliased: Fixture.AliasedInPlace = (cell) => { cell.value += 1; };
export const unspelled: Fixture.Unspelled = inplace;
export const scalar: Fixture.Scalar = (value) => value + 1;
export const array: Fixture.Array = (values) => values.slice();
export const outputs = (iter: Gtk.TextIter): Fixture.OutRecord => () => iter;
export const ordinary = (probe: Fixture.Probe, iter: Gtk.TextIter) => {
    probe.useInPlace(inplace);
    probe.useAliasedInPlace(aliased);
    probe.useOutRecord(outputs(iter));
    probe.useScalar(scalar);
    probe.useArray(array);
};
export class Derived extends Fixture.Probe {
    useSlots(cell: Fixture.Cell, iter: Gtk.TextIter): [Gtk.TextIter, number] {
        super.vfuncInPlace(cell);
        const output: Gtk.TextIter = super.vfuncOutRecord();
        const count: number = super.vfuncScalar(3);
        return [output, count];
    }
}
export const nativeInPlace = (indenter: GtkSource.Indenter, view: GtkSource.View, iter: Gtk.TextIter): void => {
    indenter.indent(view, iter);
    indenter.vfuncIndent(view, iter);
};
`;
const REJECTED: Record<string, string> = {
    "record-callback": "export type Removed = Fixture.CellPointer;",
    "alias-record-callback": "export type Removed = Fixture.AliasPointer;",
    "object-callback": "export type Removed = Fixture.ObjectPointer;",
    "interface-callback": "export type Removed = Fixture.InterfacePointer;",
    "callback-alias": "export type Removed = Fixture.CallbackAlias;",
    "record-owner": "export type Removed = Fixture.Probe[\"useCell\"];",
    "alias-owner": "export type Removed = Fixture.Probe[\"useAlias\"];",
    "object-owner": "export type Removed = Fixture.Probe[\"useObject\"];",
    "interface-owner": "export type Removed = Fixture.Probe[\"useInterface\"];",
    "record-slot": "export class Derived extends Fixture.Probe { use(cell: Fixture.Cell) { super.vfuncCell(cell); } }",
    "alias-slot": "export class Derived extends Fixture.Probe { use(cell: Fixture.Cell) { super.vfuncAlias(cell); } }",
};
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.ts`, IMPORTS + source,
]));

describe("generated callback handle indirection", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;
    let reference: ReturnType<typeof loadApiReference>;
    let gstReference: ReturnType<typeof loadApiReference>;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/CallbackIndirection-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-callback-indirection-", config: CONFIG,
            files: { "gir/CallbackIndirection-1.0.gir": fixture, "accepted.ts": ACCEPTED, ...rejectedFiles },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
        reference = loadApiReference({
            libraries: ["CallbackIndirection-1.0"], girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        gstReference = loadApiReference({
            libraries: ["Gst-1.0"], girPath: resolveGirPath([], project.root), resolveFrom: project.root,
        });
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves in-place records, native out-pointer results and scalar or array references", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("omits unsupported callback indirection %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });

    it("aligns callback aliases, owners and retained vfunc reference pages", () => {
        for (const name of ["CellPointer", "AliasPointer", "ObjectPointer", "InterfacePointer", "CallbackAlias"]) {
            expect(reference.lookup(`CallbackIndirection.${name}`).outcome).toBe("notFound");
        }
        for (const name of ["InPlace", "AliasedInPlace", "Unspelled", "OutRecord", "Scalar", "Array"]) {
            expect(reference.lookup(`CallbackIndirection.${name}`, "callback").outcome).toBe("page");
        }
        const probe = reference.lookup("CallbackIndirection.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of ["useCell", "useAlias", "useObject", "useInterface", "vfuncCell", "vfuncAlias"]) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        for (const name of ["useInPlace", "useOutRecord", "vfuncInPlace", "vfuncOutRecord", "vfuncScalar"]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
    });

    it("omits installed pointer-cell callback contracts while retaining ordinary buffer-list readers", () => {
        for (const name of ["BufferListFunc", "BufferForeachMetaFunc", "PadStickyEventsForeachFunction"]) {
            expect(gstReference.lookup(`Gst.${name}`, "callback").outcome).toBe("notFound");
        }
        const owners = [
            ["BufferList", "record", "foreach"], ["Buffer", "record", "foreachMeta"],
            ["Pad", "class", "stickyEventsForeach"],
        ] as const;
        for (const [owner, kind, method] of owners) {
            const result = gstReference.lookup(`Gst.${owner}`, kind);
            expect(result.outcome).toBe("page");
            expect(result).toHaveProperty("markdown", expect.not.stringContaining(`### \`${method}\``));
        }
        const list = gstReference.lookup("Gst.BufferList", "record");
        expect(list).toHaveProperty("markdown", expect.stringContaining("### `length`"));
        expect(list).toHaveProperty("markdown", expect.stringContaining("### `calculateSize`"));
    });
});
