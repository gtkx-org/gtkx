import * as GObject from "@gtkx/gi/gobject";
import { alloc, type Descriptor, newObject, registerClass as registerNativeClass } from "@gtkx/native";
import { getClassType, getHandle, registerClass } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const OBJECT: Descriptor = { kind: "object", ownership: "borrowed" };
const VOID: Descriptor = { kind: "void" };
const BEYOND_CLASS_OFFSET = 4096;
const MISALIGNED_OFFSET = 4;
const VALUE_SIZE = 24;
const objectType = getClassType(GObject.Object);
const closureType = getClassType(GObject.Closure);
const typePluginType = getClassType(GObject.TypePlugin);
const registrations = { count: 0 };
const uniqueName = () => `GtkxGeneratedClassAdmission${String(registrations.count++)}`;
const ignore = (): void => undefined;
const unreached = (): never => {
    throw new Error("Unexpected callback");
};
const registeredType = () => getClassType(registerClass(class extends GObject.Object {}, { typeName: uniqueName() }));
const intValue = (value: number) => {
    const wrapped = new GObject.Value();
    wrapped.init(GObject.TYPE_INT);
    wrapped.setInt(value);

    return getHandle(wrapped);
};
const registerCounterClass = () =>
    getClassType(
        registerClass(class extends GObject.Object {}, {
            typeName: uniqueName(),
            properties: { count: GObject.paramSpecInt("count", null, null, 0, 100, 0, GObject.ParamFlags.READWRITE) },
        }),
    );

test("registering with a parent that has no class structure throws", () => {
    expect(() => registerNativeClass(uniqueName(), closureType)).toThrow();
});

test("registering a vfunc past the end of the class structure throws", () => {
    expect(() =>
        registerNativeClass(uniqueName(), objectType, {
            vfuncs: [
                {
                    byteOffset: BEYOND_CLASS_OFFSET,
                    argDescriptors: [OBJECT],
                    returnDescriptor: VOID,
                    fn: unreached,
                },
            ],
        }),
    ).toThrow();
});

test("registering a vfunc at a misaligned offset throws", () => {
    expect(() =>
        registerNativeClass(uniqueName(), objectType, {
            vfuncs: [
                {
                    byteOffset: MISALIGNED_OFFSET,
                    argDescriptors: [OBJECT],
                    returnDescriptor: VOID,
                    fn: unreached,
                },
            ],
        }),
    ).toThrow();
});

test("registering an interface type that is not an interface throws", () => {
    expect(() =>
        registerNativeClass(uniqueName(), objectType, { interfaces: [{ type: objectType, vfuncs: [] }] }),
    ).toThrow();
});

test("registering interface vfuncs without a vtable size throws", () => {
    expect(() =>
        registerNativeClass(uniqueName(), objectType, {
            interfaces: [
                {
                    type: typePluginType,
                    vfuncs: [{ byteOffset: 0, argDescriptors: [], returnDescriptor: VOID, fn: unreached }],
                },
            ],
        }),
    ).toThrow();
});

test("constructing with more property names than values throws", () => {
    const gtype = registeredType();

    expect(() => newObject(gtype, ["count"], [], {}, ignore)).toThrow();
});

test("constructing with more property values than names throws", () => {
    const gtype = registerCounterClass();

    expect(() => newObject(gtype, [], [intValue(1)], {}, ignore)).toThrow();
});

test("constructing with a property name containing a nul byte throws", () => {
    const gtype = registerCounterClass();

    expect(() => newObject(gtype, ["co\0unt"], [intValue(1)], {}, ignore)).toThrow();
});

test.each([1, VALUE_SIZE - 1])("construct property storage must fit a GValue (%i bytes)", (size) => {
    const gtype = registerCounterClass();

    expect(() => newObject(gtype, ["count"], [alloc(size)], {}, ignore)).toThrow();
});

test("constructing with an unknown property name throws", () => {
    const gtype = registeredType();

    expect(() => newObject(gtype, ["no-such-property"], [intValue(1)], {}, ignore)).toThrow();
});

test("constructing a registered type that is not instantiatable throws", () => {
    expect(() => newObject(closureType, [], [], {}, ignore)).toThrow();
});

test("constructing a not instantiatable type with properties throws", () => {
    expect(() => newObject(closureType, ["name"], [alloc(24)], {}, ignore)).toThrow();
});

test("constructing an instantiatable type that is not a GObject throws", () => {
    const paramType = getClassType(GObject.ParamSpecInt);

    expect(() => newObject(paramType, ["name"], [alloc(VALUE_SIZE)], {}, ignore)).toThrow();
});

test("a class initializer exception propagates to registration", () => {
    expect(() => registerNativeClass(uniqueName(), objectType, { initialize: unreached })).toThrow();
});
