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
    applicationId: "org.gtkx.hiddencallables",
    libraries: ["CallablePointers-1.0", "Gio-2.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as CallablePointers from "@gtkx/gi/callablepointers";
import { CallablePointersProbe } from "@gtkx/jsx/callablepointers";
`;
const ACCEPTED = IMPORTS + `
export const values = (probe: CallablePointers.Probe, bytes: GLib.Bytes, type: bigint) => {
    const count: bigint = probe.getCount();
    const typeId: bigint = probe.echoType(type);
    const boxed: GLib.Bytes = probe.echoBytes(bytes);
    const data: Uint8Array | null = bytes.getData();
    const annotated: Uint8Array | null = probe.readBytes();
    const byteArray: Uint8Array | null = probe.readByteArray();
    const globalCount: bigint = CallablePointers.safeCount();
    const payload: Uint8Array | null = probe.payload;
    const props: CallablePointers.ProbeConstructorProps = { revision: 1n, payload: new Uint8Array() };
    const instance = new CallablePointers.Probe(props);
    const view = <CallablePointersProbe {...props} onNotifyPayload={() => undefined} />;
    return { count, typeId, boxed, data, annotated, byteArray, globalCount, payload, instance, view };
};
export const handles = (task: Gio.Task, value: GObject.Value, bytes: GLib.Bytes) => {
    const owner: GObject.Object | null = task.getSourceObject();
    const context: GLib.MainContext = task.getContext();
    value.setBoxed(bytes);
    const boxed: GLib.Bytes = value.getBoxed<GLib.Bytes>();
    value.setBoxed(null);
    return { owner, context, boxed };
};
export const callbacks = (source: GLib.Source, store: Gio.ListStore, item: GObject.Object) => {
    source.setCallback(() => false);
    const found: [boolean, number] = store.findWithEqualFunc(item, (a, b) => a === b);
    const foundWithData: [boolean, number] = store.findWithEqualFuncFull(item, (a, b) => a === b);
    return { found, foundWithData };
};
`;
const REJECTED: Record<string, string> = {
    "pointer-list-property": "export const read = (value: CallablePointers.Probe) => value.rawList;",
    "pointer-array-option": "export const value = new CallablePointers.Probe({ rawArray: [] });",
    "pointer-hash-jsx": "export const view = <CallablePointersProbe rawHash={new Map()} />;",
    "pointer-list-notify": "export const view = <CallablePointersProbe onNotifyRawList={() => undefined} />;",
    "direct-input": "export const invoke = (value: CallablePointers.Probe) => value.takeDirect(null);",
    "aliased-input": "export const invoke = (value: CallablePointers.Probe) => value.takeAlias(null);",
    "direct-output": "export const invoke = (value: CallablePointers.Probe) => value.readDirect();",
    "aliased-output": "export const invoke = (value: CallablePointers.Probe) => value.readAlias();",
    "direct-return": "export const invoke = (value: CallablePointers.Probe) => value.returnDirect();",
    "aliased-return": "export const invoke = (value: CallablePointers.Probe) => value.returnAlias();",
    "skipped-return": "export const invoke = (value: CallablePointers.Probe) => value.discardPointer();",
    "pointer-array": "export const invoke = (value: CallablePointers.Probe) => value.takeArray([]);",
    "aliased-list": "export const invoke = (value: CallablePointers.Probe) => value.takeList([]);",
    "hash-values": "export const invoke = (value: CallablePointers.Probe) => value.takeHashValues(new Map());",
    "hash-keys": "export const invoke = (value: CallablePointers.Probe) => value.readHashKeys();",
    "nested-leaves": "export const invoke = (value: CallablePointers.Probe) => value.takeNested([]);",
    "static-factory": "export const value = CallablePointers.Probe.newWithData(null);",
    "namespace-input": "export const invoke = () => CallablePointers.acceptPointer(null);",
    "namespace-return": "export const invoke = () => CallablePointers.getPointer();",
    "task-return": "export const invoke = (task: Gio.Task) => task.getTaskData();",
    "task-input": "export const invoke = (task: Gio.Task) => task.setSourceTag(null);",
    "task-owned-return": "export const invoke = (task: Gio.Task) => task.propagatePointer();",
    "source-tag-return": "export type Method = GLib.Source[\"addUnixFd\"];",
    "source-tag-input": "export type Method = GLib.Source[\"removeUnixFd\"];",
    "hash-table-static": "export const invoke = () => GLib.HashTable.newSimilar(new Map());",
    "hash-table-size": "export const invoke = () => GLib.HashTable.size(new Map());",
    "hash-table-add": "export const invoke = () => GLib.HashTable.add(new Map(), 1n);",
    "hash-table-contains": "export const invoke = () => GLib.HashTable.contains(new Map(), 1n);",
    "hash-table-iterator": "export const invoke = (iterator: GLib.HashTableIter) => iterator.getHashTable();",
    "namespace-export": "export const invoke = () => GObject.typeGetQdata(GObject.TYPE_OBJECT, 0);",
    "namespace-free": "export const invoke = (instance: GObject.TypeInstance) => " +
        "GObject.typeFreeInstance(instance);",
    "enum-register-static": "export const invoke = (values: GObject.EnumValue[]) => " +
        "GObject.enumRegisterStatic('GtkxUnsafeEnum', values);",
    "flags-register-static": "export const invoke = (values: GObject.FlagsValue[]) => " +
        "GObject.flagsRegisterStatic('GtkxUnsafeFlags', values);",
    "type-module-register-enum": "export const invoke = " +
        "(module: GObject.TypeModule, values: GObject.EnumValue[]) => module.registerEnum('GtkxUnsafeEnum', values);",
    "type-module-register-flags": "export const invoke = (module: GObject.TypeModule, " +
        "values: GObject.FlagsValue[]) => module.registerFlags('GtkxUnsafeFlags', values);",
};
const NATIVE_CONSUMER = `import assert from "node:assert/strict";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import { quit } from "@gtkx/runtime";

try {
    for (const name of [
        "getSourceTag", "getTaskData", "propagatePointer", "setSourceTag", "setTaskData", "returnPointer",
    ]) {
        assert.equal(name in Gio.Task.prototype, false);
    }
    for (const name of ["addUnixFd", "modifyUnixFd", "queryUnixFd", "removeUnixFd"]) {
        assert.equal(name in GLib.Source.prototype, false);
    }
    assert.equal("newSimilar" in GLib.HashTable, false);
    assert.equal("size" in GLib.HashTable, false);
    assert.equal("add" in GLib.HashTable, false);
    assert.equal("contains" in GLib.HashTable, false);
    assert.equal("getHashTable" in GLib.HashTableIter.prototype, false);
    assert.equal("typeGetQdata" in GObject, false);
    assert.equal("typeFreeInstance" in GObject, false);
    assert.equal("enumRegisterStatic" in GObject, false);
    assert.equal("flagsRegisterStatic" in GObject, false);
    assert.equal("registerEnum" in GObject.TypeModule.prototype, false);
    assert.equal("registerFlags" in GObject.TypeModule.prototype, false);
    assert.equal(typeof GObject.TypeModule.prototype.registerType, "function");
    assert.equal(typeof Gio.Task.prototype.getSourceObject, "function");
    assert.equal(typeof Gio.Task.prototype.getContext, "function");
    assert.equal(typeof GLib.Source.prototype.setCallback, "function");
    const bytes = GLib.Bytes.new(new Uint8Array([0, 255, 3]));
    assert.deepEqual(bytes.getData(), new Uint8Array([0, 255, 3]));
    assert.deepEqual(GLib.Bytes.new([]).getData(), new Uint8Array());
    const value = new GObject.Value();
    value.init(GLib.Bytes);
    value.setBoxed(bytes);
    const boxed = value.getBoxed<GLib.Bytes>();
    assert.ok(boxed instanceof GLib.Bytes);
    assert.deepEqual(boxed.getData(), new Uint8Array([0, 255, 3]));
    value.setBoxed(null);
    assert.equal(value.getBoxed(), null);
    value.unset();
    const item = Gio.SimpleAction.new("kept", null);
    assert.equal(GObject.typeCheckInstanceIsA(item, GObject.TYPE_OBJECT), true);
    const store = Gio.ListStore.new(Gio.SimpleAction);
    store.append(item);
    const seen: (GObject.Object | null)[][] = [];
    assert.deepEqual(store.findWithEqualFuncFull(item, (a, b) => {
        seen.push([a, b]);
        return a === b;
    }), [true, 0]);
    assert.deepEqual(seen, [[item, item]]);
    store.removeAll();
} finally {
    quit();
}
`;
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.tsx`, IMPORTS + source,
]));

const OMISSIONS = [
    "takeDirect", "takeAlias", "readDirect", "readAlias", "returnDirect", "returnAlias", "discardPointer",
    "takeArray", "takeList", "takeHashValues", "readHashKeys", "takeNested", "newWithData",
    "rawList", "rawArray", "rawHash",
];

describe("generated raw-pointer callable omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/CallablePointers-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-hidden-callable-types-",
            config: CONFIG,
            files: {
                "gir/CallablePointers-1.0.gir": fixture,
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

    it("preserves safe values, annotated arrays, typed handles and existing adapters", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the omitted public callable in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });

    it("keeps class and namespace reference output aligned with supported callables", () => {
        const reference = loadApiReference({
            libraries: ["CallablePointers-1.0", "Gio-2.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        const probe = reference.lookup("CallablePointers.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of ["getCount", "echoType", "echoBytes", "readBytes", "readByteArray", "revision", "payload"]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of OMISSIONS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        const value = reference.lookup("GObject.Value", "record");
        expect(value.outcome).toBe("page");
        expect(value).toHaveProperty("markdown", expect.stringContaining("getBoxed<T = unknown>(): T"));
        expect(value).toHaveProperty("markdown", expect.stringContaining("### `setBoxed`"));
        expect(reference.lookup("CallablePointers.safeCount", "function").outcome).toBe("page");
        for (const name of [
            "CallablePointers.acceptPointer", "CallablePointers.getPointer", "GObject.typeGetQdata",
            "GObject.typeFreeInstance", "GObject.enumRegisterStatic", "GObject.flagsRegisterStatic",
        ]) {
            expect(reference.lookup(name, "function").outcome).toBe("notFound");
        }
        const typeModule = reference.lookup("GObject.TypeModule", "class");
        expect(typeModule.outcome).toBe("page");
        expect(typeModule).toHaveProperty("markdown", expect.not.stringContaining("### `registerEnum`"));
        expect(typeModule).toHaveProperty("markdown", expect.not.stringContaining("### `registerFlags`"));
        expect(typeModule).toHaveProperty("markdown", expect.stringContaining("### `registerType`"));
    });

    it("imports the remaining public exports and exercises safe boxed values and comparators", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-hidden-callable-values-",
            config: 'export default { applicationId: "org.gtkx.hiddencallablevalues", libraries: ["Gio-2.0"],' +
                " agents: { reference: false, rules: false } };",
            files: { "probe.ts": NATIVE_CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
