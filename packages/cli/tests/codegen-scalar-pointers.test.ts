import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.scalarpointers",
    libraries: ["ScalarPointers-1.0", "GdkPixbuf-2.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as ScalarPointers from "@gtkx/gi/scalarpointers";
import * as GObject from "@gtkx/gi/gobject";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import { ScalarPointersProbe } from "@gtkx/jsx/scalarpointers";
`;
const ACCEPTED = IMPORTS + `
export const values = (probe: ScalarPointers.Probe, mode: ScalarPointers.Mode, object: GObject.Object) => {
    const read: number = probe.readNumber();
    const erasedOut: number = probe.readErased();
    const erasedInout: number = probe.editErased(5);
    const edited: number = probe.editNumber(7);
    const count: ScalarPointers.Count = probe.readCount();
    const array: number[] | null = probe.readArray();
    const type: GObject.Type = GObject.typeFromName("GObject");
    probe.useValues(mode, type, "text", object);
    probe.takeArray([1, 2]);
    probe.useInout((value: number) => value + 1);
    const callback: ScalarPointers.InoutScalar = (value) => value + 1;
    const outCallback: ScalarPointers.OutScalar = () => 7;
    return { read, erasedOut, erasedInout, edited, count, array, callback, outCallback };
};
export class DerivedProbe extends ScalarPointers.Probe {
    readValue(): number {
        return this.vfuncSafeOut();
    }
}
export const properties = (probe: ScalarPointers.Probe, frame: ScalarPointers.Frame) => {
    const count: bigint = probe.count;
    const options: ScalarPointers.ProbeConstructorProps = { count: 3n };
    const value = new ScalarPointers.Probe(options);
    const record = new ScalarPointers.Frame({ before: 1, after: 2n });
    frame.before = 2;
    frame.after = 3n;
    const view = <ScalarPointersProbe {...options} onInteger={(value: bigint) => { void value; }} />;
    return { count, value, record, view };
};
export const controls = (message: Gio.InputMessage, outgoing: Gio.OutputMessage, hmac: GLib.Hmac) => {
    const count: number = outgoing.numControlMessages;
    const vectors: number = message.numVectors;
    const bytes: number = message.bytesReceived;
    const copy: GLib.Hmac = hmac.copy();
    const digest: string = hmac.getString();
    const input: Gtk.SpinButtonSignals["input"] = () => [0, 2];
    return { count, vectors, bytes, copy, digest, input };
};
`;
const REJECTED: Record<string, string> = {
    "typedef-pointer-input": "export type Method = ScalarPointers.Probe[\"takeErased\"];",
    "direct-input": "export type Method = ScalarPointers.Probe[\"takeDirect\"];",
    "aliased-input": "export type Method = ScalarPointers.Probe[\"takeAlias\"];",
    "nested-input": "export type Method = ScalarPointers.Probe[\"takeNested\"];",
    "pointer-element-input": "export type Method = ScalarPointers.Probe[\"takePointers\"];",
    "enum-input": "export type Method = ScalarPointers.Probe[\"takeMode\"];",
    "gtype-input": "export type Method = ScalarPointers.Probe[\"takeType\"];",
    "pointer-return": "export type Method = ScalarPointers.Probe[\"readPointer\"];",
    "skipped-return": "export type Method = ScalarPointers.Probe[\"discardPointer\"];",
    "aliased-output": "export type Method = ScalarPointers.Probe[\"readAlias\"];",
    "namespace-return": "export const method = ScalarPointers.readScalar;",
    "pointer-alias": "export type Value = ScalarPointers.PointerAlias;",
    "own-pointer-alias": "export type Value = ScalarPointers.OwnPointer;",
    "nested-alias": "export type Value = ScalarPointers.PointerList;",
    "callback-input": "export type Callback = ScalarPointers.InputScalar;",
    "callback-return": "export type Callback = ScalarPointers.ReturnScalar;",
    "callback-consumer": "export type Method = ScalarPointers.Probe[\"useRaw\"];",
    "signal-input": "export type Signal = ScalarPointers.ProbeSignals[\"scalar-pointer\"];",
    "signal-return": "export type Signal = ScalarPointers.ProbeSignals[\"scalar-return\"];",
    "vfunc-input": "export class Derived extends ScalarPointers.Probe { " +
        "override vfuncRawInput(value: number): void { void value; } }",
    "direct-field": "export type Field = ScalarPointers.Frame[\"direct\"];",
    "aliased-field": "export type Field = ScalarPointers.Frame[\"alias\"];",
    "pointer-element-field": "export type Field = ScalarPointers.Frame[\"pointers\"];",
    "record-options": "export const props: ScalarPointers.FrameConstructorProps = { direct: 1 };",
    "property-read": "export type Property = ScalarPointers.Probe[\"pointer\"];",
    "property-options": "export const props: ScalarPointers.ProbeConstructorProps = { pointer: 1 };",
    "property-jsx": "export const view = <ScalarPointersProbe pointer={1} />;",
    "property-notify": "export const view = <ScalarPointersProbe onNotifyPointer={() => undefined} />;",
    "pixbuf-return": "export type Method = GdkPixbuf.Pixbuf[\"readPixels\"];",
    "byte-array-field": "export type Field = GLib.ByteArray[\"data\"];",
    "message-field": "export type Field = Gio.InputMessage[\"numControlMessages\"];",
};
const NATIVE_CONSUMER = `import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import { quit } from "@gtkx/runtime";

try {
    assert.equal("readPixels" in GdkPixbuf.Pixbuf.prototype, false);
    assert.equal("data" in GLib.ByteArray.prototype, false);
    assert.equal("numControlMessages" in Gio.InputMessage.prototype, false);
    assert.equal("numControlMessages" in Gio.OutputMessage.prototype, true);
    const key = new Uint8Array([0, 1, 254]);
    const keyBytes = GLib.Bytes.new(key);
    for (const data of [new Uint8Array([3, 0, 255, 4]), new Uint8Array()]) {
        const expected = createHmac("sha256", key).update(data).digest("hex");
        const dataBytes = GLib.Bytes.new(data);
        assert.equal(GLib.computeHmacForBytes(GLib.ChecksumType.SHA256, keyBytes, dataBytes), expected);
        assert.equal(GLib.computeHmacForData(GLib.ChecksumType.SHA256, key, data), expected);
        assert.deepEqual(dataBytes.getData(), data);
    }
    assert.deepEqual(keyBytes.getData(), key);
    const text = "Aλ😀";
    const characters = ["A", "λ", "😀"];
    assert.deepEqual(GLib.utf8ToUcs4(text, -1n), [characters, 7n, 3n]);
    assert.deepEqual(GLib.utf8ToUcs4Fast(text, -1n), [characters, 3n]);
    assert.deepEqual(GLib.utf16ToUcs4([0x41, 0x03BB, 0xD83D, 0xDE00]), [characters, 4n, 3n]);
    assert.deepEqual(GLib.ucs4ToUtf8(characters), [text, 3n, 7n]);
    assert.deepEqual(GLib.utf8ToUcs4("", -1n), [[], 0n, 0n]);
    assert.deepEqual(GLib.utf8ToUcs4Fast("", -1n), [[], 0n]);
} finally {
    quit();
}
`;
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.tsx`, IMPORTS + source,
]));
const OMITTED_METHODS = [
    "takeDirect", "takeAlias", "takeNested", "takeMode", "takeType", "readPointer", "discardPointer",
    "readAlias", "useRaw", "takePointers", "takeErased",
];

describe("generated scalar C pointer omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;
    let reference: ReturnType<typeof loadApiReference>;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/ScalarPointers-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-scalar-pointer-types-",
            config: CONFIG,
            files: {
                "gir/ScalarPointers-1.0.gir": fixture,
                "accepted.tsx": ACCEPTED,
                "native.ts": NATIVE_CONSUMER,
                ...rejectedFiles,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
        reference = loadApiReference({
            libraries: ["ScalarPointers-1.0", "Gtk-4.0", "GdkPixbuf-2.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves scalar values, directional refs, typed handles and annotated arrays", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the omitted public contract in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });

    it("aligns method, property, signal and field references", () => {
        const probe = reference.lookup("ScalarPointers.Probe", "class");
        const element = reference.lookup("ScalarPointersProbe", "element");
        const frame = reference.lookup("ScalarPointers.Frame", "record");
        expect(probe.outcome).toBe("page");
        expect(element.outcome).toBe("page");
        expect(frame.outcome).toBe("page");
        for (const name of [
            "readNumber", "editNumber", "readCount", "readArray", "useValues", "takeArray", "useInout", "count",
        ]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of [...OMITTED_METHODS, "pointer", "scalar-pointer", "scalar-return"]) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        expect(element).toHaveProperty("markdown", expect.stringContaining("### `onInteger`"));
        for (const name of ["pointer", "onScalarPointer", "onScalarReturn"]) {
            expect(element).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        for (const name of ["before", "after"]) {
            expect(frame).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of ["direct", "alias", "pointers"]) {
            expect(frame).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
    });

    it("omits pointer aliases and callback references while retaining scalar callbacks", () => {
        for (const name of ["IntPointer", "PointerAlias", "PointerList", "OwnPointer"]) {
            expect(reference.lookup(`ScalarPointers.${name}`, "alias").outcome).toBe("notFound");
        }
        for (const name of ["InputScalar", "ReturnScalar"]) {
            expect(reference.lookup(`ScalarPointers.${name}`, "callback").outcome).toBe("notFound");
        }
        expect(reference.lookup("ScalarPointers.Count", "alias").outcome).toBe("page");
        expect(reference.lookup("ScalarPointers.InoutScalar", "callback").outcome).toBe("page");
        expect(reference.lookup("ScalarPointers.OutScalar", "callback").outcome).toBe("page");
        expect(reference.lookup("ScalarPointers.readScalar", "function").outcome).toBe("notFound");
    });

    it("uses supported HMAC byte APIs and corrected Unicode arrays", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-scalar-pointer-values-",
            config: 'export default { applicationId: "org.gtkx.scalarpointervalues", libraries: ["GdkPixbuf-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
