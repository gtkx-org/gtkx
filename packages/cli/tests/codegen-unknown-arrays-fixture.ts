import { readFileSync } from "node:fs";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.unknownarrays",
    libraries: ["UnknownArrays-1.0", "GdkPixbuf-2.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as UnknownArrays from "@gtkx/gi/unknownarrays";
import * as Gio from "@gtkx/gi/gio";
import * as Gdk from "@gtkx/gi/gdk";
import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import * as Pango from "@gtkx/gi/pango";
import { UnknownArraysProbe } from "@gtkx/jsx/unknownarrays";
`;
const ACCEPTED = IMPORTS + `
export const arrays = (probe: UnknownArrays.Probe, pixbuf: GdkPixbuf.Pixbuf) => {
    const sized: Uint8Array | null = probe.readSized();
    const fixed: Uint8Array | null = probe.readFixed();
    const terminated: Uint8Array | null = probe.readTerminated();
    const intrinsic: UnknownArrays.IntrinsicBytes = new Uint8Array([1]);
    const nested: UnknownArrays.NestedBytes = [intrinsic];
    const bytes: Uint8Array | null = probe.readIntrinsic();
    const groups: Uint8Array[] | null = probe.readNestedBytes();
    const pixels: Uint8Array = pixbuf.getPixels();
    const callbackArgs: Parameters<UnknownArrays.SizedCallback> = [intrinsic];
    probe.useSized((data) => { void data; });
    return { sized, fixed, terminated, intrinsic, nested, bytes, groups, pixels, callbackArgs };
};
export const properties = (probe: UnknownArrays.Probe) => {
    const count: bigint = probe.count;
    const payload: Uint8Array | null = probe.payload;
    const options: UnknownArrays.ProbeConstructorProps = { count: 1n, payload: new Uint8Array() };
    const value = new UnknownArrays.Probe(options);
    const view = <UnknownArraysProbe {...options} onNotifyPayload={() => undefined} />;
    return { count, payload, value, view };
};
export const record = (frame: UnknownArrays.Frame) => {
    frame.before = 1;
    frame.after = 2;
    frame.buffer = new Uint8Array([1, 2]);
    const before: number = frame.before;
    const after: number = frame.after;
    const buffer: Uint8Array = frame.buffer;
    return { before, after, buffer };
};
export const inline = new UnknownArrays.InlineRecord({ buffer: new Uint8Array([1, 2]) });
export const fullInline = (): UnknownArrays.InlineRecord => UnknownArrays.fullInlineRecord();
export const empty = new UnknownArrays.RawOnly();
export const rawRecord = (value: UnknownArrays.RawRecord): UnknownArrays.RawRecord => value;
export const emptyOptions: UnknownArrays.RawOnlyConstructorProps = {};
`;
const REJECTED = {
    "fixed-pointer-construction": "export const value = new UnknownArrays.FixedPointerRecord();",
    "aliased-pointer-construction": "export const value = new UnknownArrays.AliasedPointerRecord();",
    "fixed-pointer-full-transfer": "export const method = UnknownArrays.fullFixedPointerRecord;",
    "aliased-pointer-full-transfer": "export const method = UnknownArrays.fullAliasedPointerRecord;",
    "direct-input": "export type Method = UnknownArrays.Probe[\"takeDirect\"];",
    "aliased-output": "export type Method = UnknownArrays.Probe[\"readAlias\"];",
    "nested-return": "export type Method = UnknownArrays.Probe[\"readNested\"];",
    "skipped-return": "export type Method = UnknownArrays.Probe[\"discardArray\"];",
    "namespace-return": "export const method = UnknownArrays.unknownBytes;",
    "unknown-callback": "export type Callback = UnknownArrays.RawCallback;",
    "callback-alias": "export type Callback = UnknownArrays.CallbackAlias;",
    "callback-consumer": "export type Method = UnknownArrays.Probe[\"useRaw\"];",
    "array-alias": "export type Bytes = UnknownArrays.RawAlias;",
    "nested-alias": "export type Bytes = UnknownArrays.NestedRaw;",
    "property-read": "export type Property = UnknownArrays.Probe[\"data\"];",
    "nested-property": "export type Property = UnknownArrays.Probe[\"nested\"];",
    "property-jsx": "export const view = <UnknownArraysProbe data={1} />;",
    "property-notify": "export const view = <UnknownArraysProbe onNotifyData={() => undefined} />;",
    "property-only-options": "export const value = new UnknownArrays.RawOnly({ data: 1 });",
    "property-only-variable": "const options = { data: 1 }; export const value = new UnknownArrays.RawOnly(options);",
    "property-only-props": "export const options: UnknownArrays.RawOnlyConstructorProps = { data: 1 };",
    "record-read": "export type Field = UnknownArrays.Frame[\"data\"];",
    "record-nested": "export type Field = UnknownArrays.Frame[\"nested\"];",
    "record-constructor": "export const value = new UnknownArrays.Frame({ before: 1, after: 2 });",
    "record-constructor-props": "export const props: UnknownArrays.FrameConstructorProps = { before: 1, after: 2 };",
    "record-only-constructor": "export const value = new UnknownArrays.RawRecord();",
    "record-only-variable": "const options = { data: 1 }; export const value = new UnknownArrays.RawRecord(options);",
    "record-only-props": "export const options: UnknownArrays.RawRecordConstructorProps = {};",
    "inet-address": "export const method = Gio.InetAddress.newFromBytes;",
    "texture-download": "export type Method = Gdk.Texture[\"download\"];",
    "pixbuf-input": "export const method = GdkPixbuf.Pixbuf.newFromData;",
    "pango-return": "export const method = Pango.log2visGetEmbeddingLevels;",
} as const;
const NATIVE_CONSUMER = `import assert from "node:assert/strict";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as Gdk from "@gtkx/gi/gdk";
import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import * as Pango from "@gtkx/gi/pango";
import { quit } from "@gtkx/runtime";

try {
    assert.equal("newFromBytes" in Gio.InetAddress, false);
    assert.equal("download" in Gdk.Texture.prototype, false);
    assert.equal("newFromData" in GdkPixbuf.Pixbuf, false);
    assert.equal("log2visGetEmbeddingLevels" in Pango, false);
    const data = new Uint8Array([17, 34, 51]);
    const bytes = GLib.Bytes.new(data);
    const pixbuf = GdkPixbuf.Pixbuf.newFromBytes(bytes, GdkPixbuf.Colorspace.RGB, false, 8, 1, 1, 3);
    assert.equal(pixbuf.getWidth(), 1);
    assert.equal(pixbuf.getHeight(), 1);
    assert.deepEqual(pixbuf.getPixels(), data);
    assert.deepEqual(bytes.getData(), data);
    const address = Gio.InetAddress.newFromString("127.0.0.1");
    assert.ok(address instanceof Gio.InetAddress);
    assert.equal(address.toString(), "127.0.0.1");
    assert.equal(Gio.InetAddress.newFromString("invalid"), null);
    assert.deepEqual(GLib.utf8Validate(new Uint8Array()), [true, new Uint8Array()]);
    assert.deepEqual(GLib.utf8Validate([0x61]), [true, new Uint8Array()]);
    assert.deepEqual(GLib.utf8ValidateLen([0x61, 0xFF, 0x62]), [false, new Uint8Array([0xFF, 0x62])]);
} finally {
    quit();
}
`;

type RejectedName = keyof typeof REJECTED;

const createUnknownArraysProject = (
    prefix: string,
    acceptedFiles: Record<string, string>,
    rejectedNames: readonly RejectedName[] = [],
): ReturnType<typeof createCliProject> => {
    const fixture = readFileSync(new URL("fixtures/gir/UnknownArrays-1.0.gir", import.meta.url));
    const rejectedFiles = Object.fromEntries(rejectedNames.map((name) => [
        name + ".tsx",
        IMPORTS + REJECTED[name],
    ]));
    const project = createCliProject({
        prefix,
        config: CONFIG,
        files: {
            "gir/UnknownArrays-1.0.gir": fixture,
            ...acceptedFiles,
            ...rejectedFiles,
        },
    });

    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);

    return project;
};

export { ACCEPTED, createUnknownArraysProject, NATIVE_CONSUMER, type RejectedName };
