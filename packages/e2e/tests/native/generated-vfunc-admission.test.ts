import * as GObject from "@gtkx/gi/gobject";
import { bindVfunc, call } from "@gtkx/native";
import { getClassType } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const OBJECT_TYPE = getClassType(GObject.Object);
const PLUGIN_TYPE = getClassType(GObject.TypePlugin);
const DISPOSE_OFFSET = 40;
const USE_PLUGIN_OFFSET = 16;
const UNUSE_PLUGIN_OFFSET = 24;
const PLUGIN_VTABLE_SIZE = 48;
const BEYOND_CLASS_STRUCT = 4096;

test("a slot the interface default vtable leaves empty binds and throws only when it is called", () => {
    const slot = bindVfunc({
        interfaceType: PLUGIN_TYPE,
        byteOffset: UNUSE_PLUGIN_OFFSET,
        vtableSize: PLUGIN_VTABLE_SIZE,
        label: "TypePluginInterface.unusePlugin",
        argDescriptors: [],
        returnDescriptor: { kind: "void" },
    });

    expect(() => call(slot, []).value).toThrow();
});

test("a slot of an interface the type does not implement binds and throws only when it is called", () => {
    const slot = bindVfunc({
        instanceType: OBJECT_TYPE,
        interfaceType: PLUGIN_TYPE,
        byteOffset: USE_PLUGIN_OFFSET,
        vtableSize: PLUGIN_VTABLE_SIZE,
        label: "TypePluginInterface.usePlugin",
        argDescriptors: [],
        returnDescriptor: { kind: "void" },
    });

    expect(() => call(slot, []).value).toThrow();
});

test("a byte offset past the end of the class struct throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: OBJECT_TYPE,
            byteOffset: BEYOND_CLASS_STRUCT,
            label: "GObjectClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("a byte offset that is not pointer aligned throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: OBJECT_TYPE,
            byteOffset: DISPOSE_OFFSET + 4,
            label: "GObjectClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("an instance type with no class structure throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: getClassType(GObject.Closure),
            byteOffset: DISPOSE_OFFSET,
            label: "GClosureClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("an interface slot bound without a vtable size throws", () => {
    expect(() =>
        bindVfunc({
            interfaceType: PLUGIN_TYPE,
            byteOffset: USE_PLUGIN_OFFSET,
            label: "TypePluginInterface.usePlugin",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("an unknown descriptor kind throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: OBJECT_TYPE,
            byteOffset: DISPOSE_OFFSET,
            label: "GObjectClass.dispose",
            argDescriptors: [{ kind: "nonsense" } as never],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("a negative byte offset throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: OBJECT_TYPE,
            byteOffset: -8,
            label: "GObjectClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});
