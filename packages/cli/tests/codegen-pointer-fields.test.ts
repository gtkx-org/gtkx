import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.pointerfields",
    libraries: ["PointerFields-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as PointerFields from "@gtkx/gi/pointerfields";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
`;
const ACCEPTED = IMPORTS + `
export const mixed = (record: PointerFields.Mixed) => {
    record.before = -1;
    record.after = 7n;
    const type: bigint = record.type;
    const bytes: GLib.Bytes = record.bytes;
    const buffer: Uint8Array = record.buffer;
    const numbers: number[] = record.numbers;
    const options: PointerFields.MixedConstructorProps = { before: 1, after: 2n, type: 3n };
    return { type, bytes, buffer, numbers, value: new PointerFields.Mixed(options) };
};
export const empty = new PointerFields.PointerOnly();
export const emptyOptions: PointerFields.PointerOnlyConstructorProps = {};
export const iterator = new Gtk.TreeIter({ stamp: 42 });
export const option = (entry: GLib.OptionEntry) => {
    entry.longName = "verbose";
    entry.flags = 0;
    return { name: entry.longName, arg: entry.arg };
};
`;
const REJECTED: Record<string, string> = {
    "direct-read": "export const read = (record: PointerFields.Mixed) => record.direct;",
    "direct-write": "export const write = (record: PointerFields.Mixed): void => { record.direct = 1n; };",
    "direct-option": "export const record = new PointerFields.Mixed({ direct: null });",
    "aliased-read": "export const read = (record: PointerFields.Mixed) => record.aliased;",
    "aliased-option": "export const record = new PointerFields.Mixed({ aliased: 1n });",
    "inline-array": "export const read = (record: PointerFields.Mixed) => record.inlinePointers;",
    "pointer-array": "export const read = (record: PointerFields.Mixed) => record.pointedPointers;",
    "pointer-list": "export type Field = PointerFields.Mixed[\"list\"];",
    "pointer-keys": "export type Field = PointerFields.Mixed[\"keys\"];",
    "pointer-values": "export type Field = PointerFields.Mixed[\"values\"];",
    "only-pointer-option": "export const record = new PointerFields.PointerOnly({ data: null });",
    "only-pointer-variable": "const options = { data: 1n }; " +
        "export const record = new PointerFields.PointerOnly(options);",
    "only-pointer-props": "export const options: PointerFields.PointerOnlyConstructorProps = { data: 1n };",
    "iterator-read": "export const read = (iterator: Gtk.TreeIter) => iterator.userData;",
    "iterator-option": "export const iterator = new Gtk.TreeIter({ userData: 1n });",
    "option-entry": "export const read = (entry: GLib.OptionEntry) => entry.argData;",
    "log-field": "export const read = (field: GLib.LogField) => field.value;",
    "wrong-scalar": "export const record = new PointerFields.Mixed({ after: \"invalid\" });",
};
const NATIVE = `import assert from "node:assert/strict";
import * as Gtk from "@gtkx/gi/gtk";
import * as GLib from "@gtkx/gi/glib";
import { quit } from "@gtkx/runtime";

try {
    const iterator = new Gtk.TreeIter({ stamp: 42 });
    assert.equal(iterator.stamp, 42);
    const copy = iterator.copy();
    iterator.stamp = 7;
    assert.equal(copy.stamp, 42);
    assert.equal(iterator.stamp, 7);
    assert.equal(new Gtk.TreeIter().stamp, 0);
    for (const name of ["userData", "userData2", "userData3"]) {
        assert.equal(name in iterator, false);
    }
    assert.equal("argData" in GLib.OptionEntry.prototype, false);
    assert.equal("value" in GLib.LogField.prototype, false);
    assert.throws(() => Reflect.set(iterator, "stamp", "invalid"));
    assert.equal(iterator.stamp, 7);
} finally {
    quit();
}
`;
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.ts`, IMPORTS + source,
]));

describe("generated pointer record fields", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/PointerFields-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-pointer-field-types-",
            config: CONFIG,
            files: {
                "gir/PointerFields-1.0.gir": fixture,
                "accepted.ts": ACCEPTED,
                "native.ts": NATIVE,
                ...rejectedFiles,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves numeric fields, typed handles, arrays and empty construction", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects unsupported field use in %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });

    it("documents only supported field values", () => {
        const reference = loadApiReference({
            libraries: ["PointerFields-1.0", "Gtk-4.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("PointerFields.Mixed", "record");
        expect(page.outcome).toBe("page");
        for (const name of ["before", "after", "type", "bytes", "buffer", "numbers"]) {
            expect(page).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of ["direct", "aliased", "inlinePointers", "pointedPointers", "list", "keys", "values"]) {
            expect(page).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        const iterator = reference.lookup("Gtk.TreeIter", "record");
        expect(iterator).toHaveProperty("markdown", expect.stringContaining("### `stamp`"));
        expect(iterator).toHaveProperty("markdown", expect.not.stringContaining("### `userData`"));
    });

    it("copies ordinary native records and omits their pointer fields", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-pointer-field-values-",
            config: 'export default { applicationId: "org.gtkx.pointerfieldvalues",' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
