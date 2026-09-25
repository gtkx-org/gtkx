import { readFileSync } from "node:fs";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

const SCALAR_POINTER_CONFIG = `export default {
    applicationId: "org.gtkx.scalarpointers",
    libraries: ["ScalarPointers-1.0", "GdkPixbuf-2.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const SCALAR_POINTER_IMPORTS = `import * as ScalarPointers from "@gtkx/gi/scalarpointers";
import * as GObject from "@gtkx/gi/gobject";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import { ScalarPointersProbe } from "@gtkx/jsx/scalarpointers";
`;
const SCALAR_POINTER_ACCEPTED = SCALAR_POINTER_IMPORTS + `
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
const SCALAR_POINTER_NATIVE_CONSUMER = `import assert from "node:assert/strict";
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
const SCALAR_POINTER_REJECTED_INPUTS: Record<string, string> = {
    "typedef-pointer-input": "export type Method = ScalarPointers.Probe[\"takeErased\"];",
    "direct-input": "export type Method = ScalarPointers.Probe[\"takeDirect\"];",
    "aliased-input": "export type Method = ScalarPointers.Probe[\"takeAlias\"];",
    "nested-input": "export type Method = ScalarPointers.Probe[\"takeNested\"];",
    "pointer-element-input": "export type Method = ScalarPointers.Probe[\"takePointers\"];",
    "enum-input": "export type Method = ScalarPointers.Probe[\"takeMode\"];",
    "gtype-input": "export type Method = ScalarPointers.Probe[\"takeType\"];",
};
const SCALAR_POINTER_REJECTED_OUTPUTS: Record<string, string> = {
    "pointer-return": "export type Method = ScalarPointers.Probe[\"readPointer\"];",
    "skipped-return": "export type Method = ScalarPointers.Probe[\"discardPointer\"];",
    "aliased-output": "export type Method = ScalarPointers.Probe[\"readAlias\"];",
    "namespace-return": "export const method = ScalarPointers.readScalar;",
    "pointer-alias": "export type Value = ScalarPointers.PointerAlias;",
    "own-pointer-alias": "export type Value = ScalarPointers.OwnPointer;",
    "nested-alias": "export type Value = ScalarPointers.PointerList;",
};
const SCALAR_POINTER_REJECTED_CALLBACKS: Record<string, string> = {
    "pointer-constant": "export const value = ScalarPointers.RAW_POINTER;",
    "direct-scalar-pointer-constant": "export const value = ScalarPointers.DIRECT_SCALAR_POINTER;",
    "aliased-pointer-constant": "export const value = ScalarPointers.ALIASED_POINTER;",
    "callback-input": "export type Callback = ScalarPointers.InputScalar;",
    "callback-return": "export type Callback = ScalarPointers.ReturnScalar;",
    "callback-consumer": "export type Method = ScalarPointers.Probe[\"useRaw\"];",
};
const SCALAR_POINTER_REJECTED_MEMBERS: Record<string, string> = {
    "signal-input": "export type Signal = ScalarPointers.ProbeSignals[\"scalar-pointer\"];",
    "signal-return": "export type Signal = ScalarPointers.ProbeSignals[\"scalar-return\"];",
    "vfunc-input": "export class Derived extends ScalarPointers.Probe { " +
        "override vfuncRawInput(value: number): void { void value; } }",
    "property-read": "export type Property = ScalarPointers.Probe[\"pointer\"];",
    "property-options": "export const props: ScalarPointers.ProbeConstructorProps = { pointer: 1 };",
    "property-jsx": "export const view = <ScalarPointersProbe pointer={1} />;",
    "property-notify": "export const view = <ScalarPointersProbe onNotifyPointer={() => undefined} />;",
};
const SCALAR_POINTER_REJECTED_FIELDS: Record<string, string> = {
    "direct-field": "export type Field = ScalarPointers.Frame[\"direct\"];",
    "aliased-field": "export type Field = ScalarPointers.Frame[\"alias\"];",
    "pointer-element-field": "export type Field = ScalarPointers.Frame[\"pointers\"];",
    "record-options": "export const props: ScalarPointers.FrameConstructorProps = { direct: 1 };",
    "pixbuf-return": "export type Method = GdkPixbuf.Pixbuf[\"readPixels\"];",
    "byte-array-field": "export type Field = GLib.ByteArray[\"data\"];",
    "message-field": "export type Field = Gio.InputMessage[\"numControlMessages\"];",
};
const SCALAR_POINTER_OMITTED_METHODS = [
    "takeDirect", "takeAlias", "takeNested", "takeMode", "takeType", "readPointer", "discardPointer",
    "readAlias", "useRaw", "takePointers", "takeErased",
];

const scalarPointerRejectedFiles = (rejected: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(rejected).map(([name, source]) => [
        `${name}.tsx`, SCALAR_POINTER_IMPORTS + source,
    ]));

const createScalarPointerProject = (
    prefix: string,
    files: Record<string, string>,
): ReturnType<typeof createCliProject> => {
    const fixture = readFileSync(new URL("fixtures/gir/ScalarPointers-1.0.gir", import.meta.url));
    const project = createCliProject({
        prefix,
        config: SCALAR_POINTER_CONFIG,
        files: { "gir/ScalarPointers-1.0.gir": fixture, ...files },
    });
    using pending = new DisposableStack();
    pending.use(project);
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);
    pending.move();

    return project;
};

export {
    createScalarPointerProject,
    scalarPointerRejectedFiles,
    SCALAR_POINTER_ACCEPTED,
    SCALAR_POINTER_NATIVE_CONSUMER,
    SCALAR_POINTER_OMITTED_METHODS,
    SCALAR_POINTER_REJECTED_CALLBACKS,
    SCALAR_POINTER_REJECTED_FIELDS,
    SCALAR_POINTER_REJECTED_INPUTS,
    SCALAR_POINTER_REJECTED_MEMBERS,
    SCALAR_POINTER_REJECTED_OUTPUTS,
};
