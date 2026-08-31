import { bindVfunc, call, registerClass, resolveType } from "@gtkx/native";
import { expect, test } from "vitest";

const GOBJECT = "libgobject-2.0.so.0";
const OBJECT_TYPE = resolveType(GOBJECT, "g_object_get_type");
const PLUGIN_TYPE = resolveType(GOBJECT, "g_type_plugin_get_type");
const DISPOSE_OFFSET = 40;
const FINALIZE_OFFSET = 48;
const CONSTRUCTED_OFFSET = 72;
const USE_PLUGIN_OFFSET = 16;
const UNUSE_PLUGIN_OFFSET = 24;
const PLUGIN_VTABLE_SIZE = 48;
const BEYOND_CLASS_STRUCT = 4096;
const BORROWED_STRING = { kind: "string", ownership: "borrowed" } as const;
const OWNED_STRING = { kind: "string", ownership: "full" } as const;

test("a bound class slot calls the implementation the class installed", () => {
    const type = registerClass("VfuncClassSlot", OBJECT_TYPE, {
        vfuncs: [
            {
                byteOffset: DISPOSE_OFFSET,
                argDescriptors: [{ kind: "int32" }],
                returnDescriptor: { kind: "int32" },
                fn: (value: number) => value * 2,
            },
        ],
    });

    const slot = bindVfunc({
        instanceType: type,
        byteOffset: DISPOSE_OFFSET,
        label: "VfuncClassSlotClass.dispose",
        argDescriptors: [{ kind: "int32" }],
        returnDescriptor: { kind: "int32" },
    });

    expect(call(slot, [21])).toBe(42);
});

test("a bound interface slot calls the implementation the class installed", () => {
    const type = registerClass("VfuncInterfaceSlot", OBJECT_TYPE, {
        interfaces: [
            {
                type: PLUGIN_TYPE,
                vtableSize: PLUGIN_VTABLE_SIZE,
                vfuncs: [
                    {
                        byteOffset: USE_PLUGIN_OFFSET,
                        argDescriptors: [{ kind: "int32" }],
                        returnDescriptor: { kind: "int32" },
                        fn: (value: number) => value + 100,
                    },
                ],
            },
        ],
    });

    const slot = bindVfunc({
        instanceType: type,
        interfaceType: PLUGIN_TYPE,
        byteOffset: USE_PLUGIN_OFFSET,
        vtableSize: PLUGIN_VTABLE_SIZE,
        label: "TypePluginInterface.usePlugin",
        argDescriptors: [{ kind: "int32" }],
        returnDescriptor: { kind: "int32" },
    });

    expect(call(slot, [1])).toBe(101);
});

test("binding against the parent type reaches the parent implementation, not the override", () => {
    const parentType = registerClass("VfuncChainUpParent", OBJECT_TYPE, {
        vfuncs: [
            {
                byteOffset: CONSTRUCTED_OFFSET,
                argDescriptors: [],
                returnDescriptor: { kind: "int32" },
                fn: () => 1,
            },
        ],
    });

    const childType = registerClass("VfuncChainUpChild", parentType, {
        vfuncs: [
            {
                byteOffset: CONSTRUCTED_OFFSET,
                argDescriptors: [],
                returnDescriptor: { kind: "int32" },
                fn: () => 2,
            },
        ],
    });

    const bindAt = (instanceType: bigint) =>
        bindVfunc({
            instanceType,
            byteOffset: CONSTRUCTED_OFFSET,
            label: "VfuncChainUpClass.constructed",
            argDescriptors: [],
            returnDescriptor: { kind: "int32" },
        });

    expect(call(bindAt(childType), [])).toBe(2);
    expect(call(bindAt(parentType), [])).toBe(1);
});

test("binding a slot a subclass leaves alone reaches the implementation it inherited", () => {
    const parentType = registerClass("VfuncInheritedParent", OBJECT_TYPE, {
        vfuncs: [
            {
                byteOffset: CONSTRUCTED_OFFSET,
                argDescriptors: [],
                returnDescriptor: { kind: "int32" },
                fn: () => 7,
            },
        ],
    });

    const childType = registerClass("VfuncInheritedChild", parentType);

    const slot = bindVfunc({
        instanceType: childType,
        byteOffset: CONSTRUCTED_OFFSET,
        label: "VfuncInheritedChildClass.constructed",
        argDescriptors: [],
        returnDescriptor: { kind: "int32" },
    });

    expect(call(slot, [])).toBe(7);
});

test("a slot taking no arguments and returning void runs its implementation", () => {
    let runs = 0;

    const type = registerClass("VfuncVoidSlot", OBJECT_TYPE, {
        vfuncs: [
            {
                byteOffset: FINALIZE_OFFSET,
                argDescriptors: [],
                returnDescriptor: { kind: "void" },
                fn: () => {
                    runs += 1;
                },
            },
        ],
    });

    const slot = bindVfunc({
        instanceType: type,
        byteOffset: FINALIZE_OFFSET,
        label: "VfuncVoidSlotClass.finalize",
        argDescriptors: [],
        returnDescriptor: { kind: "void" },
    });

    expect(call(slot, [])).toBeUndefined();
    expect(runs).toBe(1);
});

test("a slot declaring string descriptors marshals the argument and the return value", () => {
    const type = registerClass("VfuncStringSlot", OBJECT_TYPE, {
        vfuncs: [
            {
                byteOffset: DISPOSE_OFFSET,
                argDescriptors: [BORROWED_STRING],
                returnDescriptor: OWNED_STRING,
                fn: (value: string) => `${value}-x`,
            },
        ],
    });

    const slot = bindVfunc({
        instanceType: type,
        byteOffset: DISPOSE_OFFSET,
        label: "VfuncStringSlotClass.dispose",
        argDescriptors: [BORROWED_STRING],
        returnDescriptor: OWNED_STRING,
    });

    expect(call(slot, ["gtk"])).toBe("gtk-x");
});

test("the same bound slot can be called repeatedly", () => {
    const type = registerClass("VfuncRepeatSlot", OBJECT_TYPE, {
        vfuncs: [
            {
                byteOffset: DISPOSE_OFFSET,
                argDescriptors: [{ kind: "int32" }],
                returnDescriptor: { kind: "int32" },
                fn: (value: number) => value + 1,
            },
        ],
    });

    const slot = bindVfunc({
        instanceType: type,
        byteOffset: DISPOSE_OFFSET,
        label: "VfuncRepeatSlotClass.dispose",
        argDescriptors: [{ kind: "int32" }],
        returnDescriptor: { kind: "int32" },
    });

    expect([call(slot, [1]), call(slot, [2]), call(slot, [3])]).toEqual([2, 3, 4]);
});

test("a slot the interface default vtable leaves empty binds and throws only when it is called", () => {
    const slot = bindVfunc({
        interfaceType: PLUGIN_TYPE,
        byteOffset: UNUSE_PLUGIN_OFFSET,
        vtableSize: PLUGIN_VTABLE_SIZE,
        label: "TypePluginInterface.unusePlugin",
        argDescriptors: [],
        returnDescriptor: { kind: "void" },
    });

    expect(() => call(slot, [])).toThrow();
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

    expect(() => call(slot, [])).toThrow();
});

test("an implementation that throws propagates out of the call", () => {
    const type = registerClass("VfuncThrowingSlot", OBJECT_TYPE, {
        vfuncs: [
            {
                byteOffset: DISPOSE_OFFSET,
                argDescriptors: [],
                returnDescriptor: { kind: "int32" },
                fn: () => {
                    throw new Error("boom");
                },
            },
        ],
    });

    const slot = bindVfunc({
        instanceType: type,
        byteOffset: DISPOSE_OFFSET,
        label: "VfuncThrowingSlotClass.dispose",
        argDescriptors: [],
        returnDescriptor: { kind: "int32" },
    });

    expect(() => call(slot, [])).toThrow();
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

test("binding with neither an instance type nor an interface type throws", () => {
    expect(() =>
        bindVfunc({
            byteOffset: DISPOSE_OFFSET,
            label: "GObjectClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("a zero instance type throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: 0n,
            byteOffset: DISPOSE_OFFSET,
            label: "GObjectClass.dispose",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("a zero interface type throws", () => {
    expect(() =>
        bindVfunc({
            interfaceType: 0n,
            byteOffset: USE_PLUGIN_OFFSET,
            vtableSize: PLUGIN_VTABLE_SIZE,
            label: "TypePluginInterface.usePlugin",
            argDescriptors: [],
            returnDescriptor: { kind: "void" },
        }),
    ).toThrow();
});

test("an instance type with no class structure throws", () => {
    expect(() =>
        bindVfunc({
            instanceType: resolveType(GOBJECT, "g_closure_get_type"),
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

test("options missing a required field throw", () => {
    expect(() => bindVfunc({ label: "GObjectClass.dispose" } as never)).toThrow();
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
