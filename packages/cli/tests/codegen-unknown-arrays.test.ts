import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    isolateTypeConsumer,
    runNativeConsumer,
    typecheckFile,
} from "./type-consumer.js";

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
    const buffer: Uint8Array = frame.buffer;
    const options: UnknownArrays.FrameConstructorProps = { before: 1, after: 2 };
    return { buffer, value: new UnknownArrays.Frame(options) };
};
export const inline = new UnknownArrays.InlineRecord({ buffer: new Uint8Array([1, 2]) });
export const fullInline = (): UnknownArrays.InlineRecord => UnknownArrays.fullInlineRecord();
export const empty = new UnknownArrays.RawOnly();
export const emptyRecord = new UnknownArrays.RawRecord();
export const emptyOptions: UnknownArrays.RawOnlyConstructorProps = {};
export const emptyRecordOptions: UnknownArrays.RawRecordConstructorProps = {};
`;
const REJECTED: Record<string, string> = {
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
    "record-only-variable": "const options = { data: 1 }; export const value = new UnknownArrays.RawRecord(options);",
    "record-only-props": "export const options: UnknownArrays.RawRecordConstructorProps = { data: 1 };",
    "inet-address": "export const method = Gio.InetAddress.newFromBytes;",
    "texture-download": "export type Method = Gdk.Texture[\"download\"];",
    "pixbuf-input": "export const method = GdkPixbuf.Pixbuf.newFromData;",
    "pango-return": "export const method = Pango.log2visGetEmbeddingLevels;",
};
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
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.tsx`, IMPORTS + source,
]));
const OMITTED_MEMBERS = ["takeDirect", "readAlias", "readNested", "discardArray", "useRaw", "data", "nested"];

describe("generated unknown-length array omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/UnknownArrays-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-unknown-array-types-",
            config: CONFIG,
            files: {
                "gir/UnknownArrays-1.0.gir": fixture,
                "accepted.tsx": ACCEPTED,
                "native.ts": NATIVE_CONSUMER,
                ...rejectedFiles,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves bounded arrays, intrinsic byte arrays and neighboring properties and fields", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the omitted public contract in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });

    it("keeps references aligned with omitted aliases and retained array methods", () => {
        const reference = loadApiReference({
            libraries: ["UnknownArrays-1.0", "Gtk-4.0", "GdkPixbuf-2.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        const probe = reference.lookup("UnknownArrays.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of [
            "readSized", "readFixed", "readTerminated", "readIntrinsic", "readNestedBytes",
            "useSized", "count", "payload",
        ]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of OMITTED_MEMBERS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        const frame = reference.lookup("UnknownArrays.Frame", "record");
        expect(frame.outcome).toBe("page");
        for (const name of ["before", "after", "buffer"]) {
            expect(frame).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of ["data", "nested"]) {
            expect(frame).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        for (const name of ["RawBytes", "RawAlias", "NestedRaw", "CallbackAlias"]) {
            expect(reference.lookup(`UnknownArrays.${name}`, "alias").outcome).toBe("notFound");
        }
        expect(reference.lookup("UnknownArrays.RawCallback", "callback").outcome).toBe("notFound");
        expect(reference.lookup("UnknownArrays.unknownBytes", "function").outcome).toBe("notFound");
        expect(reference.lookup("UnknownArrays.IntrinsicBytes", "alias").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.NestedBytes", "alias").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.SizedCallback", "callback").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.fullInlineRecord", "function").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.fullFixedPointerRecord", "function").outcome).toBe("notFound");
        expect(reference.lookup("UnknownArrays.fullAliasedPointerRecord", "function").outcome).toBe("notFound");
        const pixbuf = reference.lookup("GdkPixbuf.Pixbuf", "class");
        expect(pixbuf.outcome).toBe("page");
        expect(pixbuf).toHaveProperty("markdown", expect.stringContaining("getPixels(): Uint8Array"));
        expect(pixbuf).toHaveProperty("markdown", expect.not.stringContaining("### `newFromData`"));
    });

    it("uses supported native alternatives and the sized Pixbuf shadow", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-known-array-values-",
            config: 'export default { applicationId: "org.gtkx.knownarrayvalues", libraries: ["GdkPixbuf-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
