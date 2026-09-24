import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { runNativeConsumer } from "./native-consumer.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.callercontainers",
    libraries: ["CallerContainers-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as CallerContainers from "@gtkx/gi/callercontainers";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Pango from "@gtkx/gi/pango";
`;
const ACCEPTED = IMPORTS + `
export const inputs = (probe: CallerContainers.Probe): void => {
    const callback: CallerContainers.Input = (values) => probe.accept(values);
    callback(["first", "second"]);
    const fixed: [boolean, number[]] = CallerContainers.fillFixed();
    const rectangle: Gdk.Rectangle = CallerContainers.fillRecord();
    void fixed;
    void rectangle;
};
export class ContainerInput extends CallerContainers.Probe {
    override vfuncAccept(values: string[]): void {
        this.accept(values);
    }
}
export const arrayInputs: CallerContainers.ByteInput = (bytes) => { void bytes; };
export const bytes = (stream: Gio.InputStream): GLib.Bytes => stream.readBytes(3, null);
export const asyncBytes = (stream: Gio.InputStream): Promise<GLib.Bytes> => stream.readBytesAsync(3, 0, null);
export type ReadFinish = Gio.InputStream["vfuncReadFinish"];
export type FontMetrics = Pango.Font["vfuncGetMetrics"];
export const icons = (icon: Gio.Icon): GLib.Variant | null => {
    const implementation: Gio.IconImpl = { vfuncSerialize: () => icon.serialize() };
    const text: string | null = icon.toString();
    if (text !== null) {
        Gio.Icon.newForString(text);
    }
    void implementation;
    return icon.vfuncSerialize();
};
export const queries = (tls: Gio.TlsConnection, dtls: Gio.DtlsConnection): boolean[] => [
    tls.getChannelBindingData(Gio.TlsChannelBindingType.UNIQUE),
    dtls.getChannelBindingData(Gio.TlsChannelBindingType.UNIQUE),
];
`;
const REJECTED: Record<string, string> = {
    "pollable-carray": "export type Method = Gio.PollableInputStream[\"vfuncReadNonblocking\"];",
    "pollable-carray-requirement": "export type Method = Gio.PollableInputStreamImpl[\"vfuncReadNonblocking\"];",
    "input-stream-carray": "export type Method = Gio.InputStream[\"vfuncReadAsync\"];",
    "font-features-carray": "export type Method = Pango.Font[\"vfuncGetFeatures\"];",
    "sized-carray-callback": "export type Callback = CallerContainers.SizedOut;",
    "fixed-carray-callback": "export type Callback = CallerContainers.FixedOut;",
    "aliased-carray-callback": "export type Callback = CallerContainers.AliasedBytesOut;",
    "sized-carray-owner": "export const method = CallerContainers.useFillSized;",
    "fixed-carray-owner": "export const method = CallerContainers.useFillFixed;",
    "aliased-carray-owner": "export const method = CallerContainers.useFillAliasedBytes;",
    "sized-carray-vfunc": "export type Method = CallerContainers.Probe[\"vfuncFillSized\"];",
    "fixed-carray-vfunc": "export type Method = CallerContainers.Probe[\"vfuncFillFixed\"];",
    "aliased-carray-vfunc": "export type Method = CallerContainers.Probe[\"vfuncFillAliasedBytes\"];",
    "icon-member": "export type Method = Gio.Icon[\"vfuncToTokens\"];",
    "icon-requirement": "export type Method = Gio.IconImpl[\"vfuncToTokens\"];",
    "ptr-callback": "export type Callback = CallerContainers.PtrOut;",
    "aliased-container-callback": "export type Callback = CallerContainers.AliasOut;",
    "hash-callback": "export type Callback = CallerContainers.HashOut;",
    "optional-byte-callback": "export type Callback = CallerContainers.OptionalBytesOut;",
    "callback-alias": "export type Callback = CallerContainers.OutAlias;",
    "ptr-owner": "export type Method = CallerContainers.Probe[\"useFillTokens\"];",
    "alias-owner": "export type Method = CallerContainers.Probe[\"useFillAlias\"];",
    "hash-owner": "export type Method = CallerContainers.Probe[\"useFillHash\"];",
    "optional-byte-owner": "export type Method = CallerContainers.Probe[\"useFillBytes\"];",
    "ptr-vfunc": "export type Method = CallerContainers.Probe[\"vfuncFillTokens\"];",
    "alias-vfunc": "export type Method = CallerContainers.Probe[\"vfuncFillAlias\"];",
    "hash-vfunc": "export type Method = CallerContainers.Probe[\"vfuncFillHash\"];",
    "optional-byte-vfunc": "export type Method = CallerContainers.Probe[\"vfuncFillBytes\"];",
};
const REJECTED_FILES = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.ts`, IMPORTS + source,
]));
const OMITTED_CALLBACKS = [
    "PtrOut", "AliasOut", "HashOut", "OptionalBytesOut", "OutAlias", "SizedOut", "FixedOut", "AliasedBytesOut",
];
const OMITTED_METHODS = [
    "useFillTokens", "useFillAlias", "useFillHash", "useFillBytes",
    "vfuncFillTokens", "vfuncFillAlias", "vfuncFillHash", "vfuncFillBytes",
    "vfuncFillSized", "vfuncFillFixed", "vfuncFillAliasedBytes",
];
const NATIVE_CONSUMER = `import assert from "node:assert/strict";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { quit, registerClass } from "@gtkx/runtime";

class SerializingIcon extends Gio.ThemedIcon {
    serializations = 0;
    serializeNull = false;

    override vfuncSerialize(): GLib.Variant | null {
        this.serializations += 1;
        return this.serializeNull ? null : super.vfuncSerialize();
    }
}
registerClass(SerializingIcon, { typeName: "GtkxCallerContainerIcon" });

try {
    const icon = Gio.ThemedIcon.newFromNames(["document-open", "document-save"]);
    assert.equal("vfuncToTokens" in icon, false);
    const text = icon.toString();
    assert.ok(text !== null);
    assert.equal(Gio.Icon.newForString(text).equal(icon), true);
    const serialized = icon.serialize();
    assert.ok(serialized !== null);
    assert.equal(serialized.isFloating(), false);
    const restored = Gio.Icon.deserialize(serialized);
    assert.ok(restored !== null);
    assert.equal(restored.equal(icon), true);
    assert.throws(() => Gio.Icon.newForString(". GtkxMissingIconType token"));

    const parentValue = icon.vfuncSerialize();
    assert.ok(parentValue !== null);
    assert.equal(parentValue.isFloating(), false);
    const boxed = GLib.Variant.newVariant(parentValue);
    const tuple = GLib.Variant.newTuple([parentValue]);
    assert.equal(boxed.getVariant().equal(serialized), true);
    assert.equal(tuple.getChildValue(0).equal(serialized), true);
    assert.equal(parentValue.equal(serialized), true);
    assert.equal(parentValue.isFloating(), false);

    const ordinary = GLib.Variant.newString("preserved");
    assert.equal(ordinary.isFloating(), false);
    const ordinaryTuple = GLib.Variant.newTuple([ordinary]);
    assert.deepEqual(ordinaryTuple.getChildValue(0).getString(), ["preserved", 9]);
    assert.deepEqual(ordinary.getString(), ["preserved", 9]);

    const implemented = new SerializingIcon({ names: ["document-open", "document-save"] });
    const value = implemented.serialize();
    assert.ok(value !== null);
    const copied = Gio.Icon.deserialize(value);
    assert.ok(copied instanceof Gio.ThemedIcon);
    assert.deepEqual(copied.getNames(), implemented.getNames());
    assert.equal(implemented.serializations, 1);
    assert.equal(value.isFloating(), false);
    implemented.serializeNull = true;
    assert.equal(implemented.serialize(), null);
    assert.equal(implemented.serializations, 2);
    assert.equal(value.equal(serialized), true);
} finally {
    quit();
}
`;

describe("generated caller-allocated container admission", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/CallerContainers-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-caller-containers-",
            config: CONFIG,
            files: { "gir/CallerContainers-1.0.gir": fixture, "accepted.ts": ACCEPTED, ...REJECTED_FILES },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves ordinary inputs, fixed buffers, records, Icon serialization and optional TLS queries", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the unrepresentable caller output %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });

    it("omits unsupported callback and vfunc reference entries while retaining supported contracts", () => {
        const reference = loadApiReference({
            libraries: ["CallerContainers-1.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        for (const name of OMITTED_CALLBACKS) {
            expect(reference.lookup(`CallerContainers.${name}`).outcome).toBe("notFound");
        }
        const probe = reference.lookup("CallerContainers.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of OMITTED_METHODS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        expect(probe).toHaveProperty("markdown", expect.stringContaining("### `vfuncAccept`"));
        expect(reference.lookup("CallerContainers.Input", "callback").outcome).toBe("page");
        expect(reference.lookup("CallerContainers.ByteInput", "callback").outcome).toBe("page");
        expect(reference.lookup("CallerContainers.fillFixed", "function").outcome).toBe("page");
        expect(reference.lookup("CallerContainers.fillRecord", "function").outcome).toBe("page");
        const icon = reference.lookup("Gio.Icon", "interface");
        expect(icon.outcome).toBe("page");
        expect(icon).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncToTokens`"));
        expect(icon).toHaveProperty("markdown", expect.stringContaining("### `vfuncSerialize`"));
        expect(icon).toHaveProperty("markdown", expect.stringContaining("### `serialize`"));
        expect(reference.lookup("Gio.TlsConnection", "class")).toHaveProperty(
            "markdown", expect.stringContaining("getChannelBindingData(type: Gio.TlsChannelBindingType): boolean"),
        );
        expect(reference.lookup("Gio.DtlsConnection", "interface")).toHaveProperty(
            "markdown", expect.stringContaining("getChannelBindingData(type: Gio.TlsChannelBindingType): boolean"),
        );
    });

    it("omits caller-allocated C-array slots while retaining owned-byte reads and adjacent supported slots", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0", "Pango-1.0"],
            girPath: resolveGirPath([]),
            resolveFrom: process.cwd(),
        });
        const pollable = reference.lookup("Gio.PollableInputStream", "interface");
        expect(pollable.outcome).toBe("page");
        expect(pollable).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncReadNonblocking`"));
        expect(pollable).toHaveProperty("markdown", expect.stringContaining("### `vfuncIsReadable`"));
        const stream = reference.lookup("Gio.InputStream", "class");
        expect(stream.outcome).toBe("page");
        expect(stream).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncReadAsync`"));
        expect(stream).toHaveProperty("markdown", expect.stringContaining("### `vfuncReadFinish`"));
        expect(stream).toHaveProperty("markdown", expect.stringContaining("### `readBytes`"));
        expect(stream).toHaveProperty("markdown", expect.stringContaining("### `readBytesAsync`"));
        const font = reference.lookup("Pango.Font", "class");
        expect(font.outcome).toBe("page");
        expect(font).toHaveProperty("markdown", expect.not.stringContaining("### `vfuncGetFeatures`"));
        expect(font).toHaveProperty("markdown", expect.stringContaining("### `vfuncGetMetrics`"));
    });

    it("preserves native Icon serialization and the later supported vfunc slot", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-icon-serialization-",
            config: 'export default { applicationId: "org.gtkx.iconserialization", libraries: ["Gio-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
        isolateTypeConsumer(consumer);
        expect(typecheckFile(consumer, "probe.ts")).toBe(0);
    });
});
