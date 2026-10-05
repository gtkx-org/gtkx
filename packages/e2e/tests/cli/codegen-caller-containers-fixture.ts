import { readFileSync } from "node:fs";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

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
const CALLER_CARRAY_REJECTED = Object.fromEntries(
    Object.entries(REJECTED).filter(([name]) => name.includes("carray") || name.startsWith("icon-")),
);
const CALLER_CONTAINER_REJECTED = Object.fromEntries(
    Object.entries(REJECTED).filter(([name]) => !name.includes("carray") && !name.startsWith("icon-")),
);
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

const callerContainerRejectedFiles = (rejected: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(rejected).map(([name, source]) => [`${name}.ts`, IMPORTS + source]));

const createCallerContainerProject = (
    prefix: string,
    files: Record<string, string>,
): ReturnType<typeof createCliProject> => {
    const fixture = readFileSync(new URL("fixtures/gir/CallerContainers-1.0.gir", import.meta.url));
    const project = createCliProject({
        prefix,
        config: CONFIG,
        files: { "gir/CallerContainers-1.0.gir": fixture, ...files },
    });
    using pending = new DisposableStack();
    pending.use(project);
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);
    pending.move();

    return project;
};

export {
    ACCEPTED,
    CALLER_CARRAY_REJECTED,
    CALLER_CONTAINER_REJECTED,
    callerContainerRejectedFiles,
    createCallerContainerProject,
    NATIVE_CONSUMER,
    OMITTED_CALLBACKS,
    OMITTED_METHODS,
};
