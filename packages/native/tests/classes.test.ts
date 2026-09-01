import {
    alloc,
    bind,
    call,
    type Descriptor,
    type ExternalObject,
    getType,
    getTypeClass,
    type Handle,
    newObject,
    registerClass,
    resolveType,
} from "@gtkx/native";
import { expect, test } from "vitest";

const GOBJECT = "libgobject-2.0.so.0";

const BOOLEAN: Descriptor = { kind: "boolean" };
const GTYPE: Descriptor = { kind: "biguint64" };
const INT: Descriptor = { kind: "int32" };
const OBJECT: Descriptor = { kind: "object", ownership: "borrowed" };
const STRING: Descriptor = { kind: "string", ownership: "borrowed" };
const STRUCT: Descriptor = { kind: "struct", ownership: "borrowed" };
const UINT: Descriptor = { kind: "uint32" };
const VOID: Descriptor = { kind: "void" };

const SET_PROPERTY_OFFSET = 24;
const GET_PROPERTY_OFFSET = 32;
const CONSTRUCTED_OFFSET = 72;
const BEYOND_CLASS_OFFSET = 4096;
const MISALIGNED_OFFSET = 4;
const READWRITE = 3;
const VALUE_SIZE = 24;

const objectType = resolveType(GOBJECT, "g_object_get_type");
const closureType = resolveType(GOBJECT, "g_closure_get_type");
const typePluginType = resolveType(GOBJECT, "g_type_plugin_get_type");

const typeFromName = bind(GOBJECT, "g_type_from_name", [STRING], GTYPE);
const typeIsA = bind(GOBJECT, "g_type_is_a", [GTYPE, GTYPE], BOOLEAN);
const typeName = bind(GOBJECT, "g_type_name", [GTYPE], STRING);
const typeParent = bind(GOBJECT, "g_type_parent", [GTYPE], GTYPE);
const classFindProperty = bind(GOBJECT, "g_object_class_find_property", [STRUCT, STRING], STRUCT);
const paramSpecInt = bind(GOBJECT, "g_param_spec_int", [STRING, STRING, STRING, INT, INT, INT, INT], STRUCT);
const paramSpecName = bind(GOBJECT, "g_param_spec_get_name", [STRUCT], STRING);
const objectGetProperty = bind(GOBJECT, "g_object_get_property", [OBJECT, STRING, STRUCT], VOID);
const objectSetProperty = bind(GOBJECT, "g_object_set_property", [OBJECT, STRING, STRUCT], VOID);
const signalLookup = bind(GOBJECT, "g_signal_lookup", [STRING, GTYPE], UINT);
const signalName = bind(GOBJECT, "g_signal_name", [UINT], STRING);
const valueGetInt = bind(GOBJECT, "g_value_get_int", [STRUCT], INT);
const valueInit = bind(GOBJECT, "g_value_init", [STRUCT, GTYPE], VOID);
const valueSetInt = bind(GOBJECT, "g_value_set_int", [STRUCT, INT], VOID);

const registered: string[] = [];

const uniqueName = (): string => {
    const name = `GtkxNativeClassesTest${String(registered.length)}`;

    registered.push(name);

    return name;
};

const intType = call(typeFromName, ["gint"]) as bigint;
const booleanType = call(typeFromName, ["gboolean"]) as bigint;

const unreached = (): void => {
    throw new Error("this callback must not run");
};

const ignore = (): void => undefined;

const intValue = (value: number): ExternalObject<Handle> => {
    const handle = alloc(VALUE_SIZE);

    call(valueInit, [handle, intType]);
    call(valueSetInt, [handle, value]);

    return handle;
};

const intPspec = (name: string): ExternalObject<Handle> =>
    call(paramSpecInt, [name, name, name, 0, 100, 0, READWRITE]) as ExternalObject<Handle>;

const construct = (
    gtype: bigint,
    names: string[] = [],
    values: ExternalObject<Handle>[] = [],
): { adopted: object | null; handle: ExternalObject<Handle> } => {
    let bound: ExternalObject<Handle> | undefined;

    const adopted = newObject(gtype, names, values, {}, (handle) => {
        bound = handle;
    });

    if (bound === undefined) {
        throw new Error("construction did not associate a handle");
    }

    return { adopted, handle: bound };
};

const registerCounterClass = (): bigint => {
    let stored = 0;

    return registerClass(uniqueName(), objectType, {
        properties: [{ id: 1, pspec: intPspec("count") }],
        vfuncs: [
            {
                byteOffset: SET_PROPERTY_OFFSET,
                argDescriptors: [OBJECT, UINT, STRUCT, STRUCT],
                returnDescriptor: VOID,
                fn: (_instance, _id, value) => {
                    stored = call(valueGetInt, [value]) as number;
                },
            },
            {
                byteOffset: GET_PROPERTY_OFFSET,
                argDescriptors: [OBJECT, UINT, STRUCT, STRUCT],
                returnDescriptor: VOID,
                fn: (_instance, _id, value) => {
                    call(valueSetInt, [value, stored]);
                },
            },
        ],
    });
};

test("registering a subclass of GObject yields a new GType", () => {
    const gtype = registerClass(uniqueName(), objectType);

    expect(gtype).toBeGreaterThan(0n);
    expect(gtype).not.toBe(objectType);
});

test("a registered type names itself back with the name it was registered under", () => {
    const name = uniqueName();

    expect(call(typeName, [registerClass(name, objectType)])).toBe(name);
});

test("a registered type reports the parent it was derived from", () => {
    const gtype = registerClass(uniqueName(), objectType);

    expect(call(typeParent, [gtype])).toBe(objectType);
});

test("registering with no options and with empty options both derive from the parent", () => {
    const withOptions = registerClass(uniqueName(), objectType, {});
    const withoutOptions = registerClass(uniqueName(), objectType);

    expect(call(typeIsA, [withOptions, objectType])).toBe(true);
    expect(call(typeIsA, [withoutOptions, objectType])).toBe(true);
});

test("a subclass of a subclass derives from both of its ancestors", () => {
    const parent = registerClass(uniqueName(), objectType);
    const child = registerClass(uniqueName(), parent);

    expect(call(typeParent, [child])).toBe(parent);
    expect(call(typeIsA, [child, parent])).toBe(true);
    expect(call(typeIsA, [child, objectType])).toBe(true);
});

test("a registered class implements the interfaces it declares", () => {
    const gtype = registerClass(uniqueName(), objectType, {
        interfaces: [{ type: typePluginType, vfuncs: [] }],
    });

    expect(call(typeIsA, [gtype, typePluginType])).toBe(true);
});

test("a registered property is installed on the class", () => {
    const pspec = call(classFindProperty, [getTypeClass(registerCounterClass()), "count"]);

    expect(call(paramSpecName, [pspec])).toBe("count");
});

test("a property absent from the class is not found on it", () => {
    const klass = getTypeClass(registerCounterClass());

    expect(call(classFindProperty, [klass, "missing"])).toBeNull();
});

test("a construct property reaches the class's own property vfuncs", () => {
    const { handle } = construct(registerCounterClass(), ["count"], [intValue(7)]);
    const out = alloc(VALUE_SIZE);

    call(objectGetProperty, [handle, "count", out]);

    expect(call(valueGetInt, [out])).toBe(7);
});

test("a property set after construction reads back through the class", () => {
    const { handle } = construct(registerCounterClass());
    const out = alloc(VALUE_SIZE);

    call(objectSetProperty, [handle, "count", intValue(42)]);
    call(objectGetProperty, [handle, "count", out]);

    expect(call(valueGetInt, [out])).toBe(42);
});

test("a registered signal is known on the type it was created on", () => {
    const gtype = registerClass(uniqueName(), objectType, { signals: [{ name: "gtkx-changed" }] });
    const id = call(signalLookup, ["gtkx-changed", gtype]);

    expect(id).toBeGreaterThan(0);
    expect(call(signalName, [id])).toBe("gtkx-changed");
});

test("a signal created on a subclass is unknown on its parent", () => {
    registerClass(uniqueName(), objectType, { signals: [{ name: "gtkx-vanished" }] });

    expect(call(signalLookup, ["gtkx-vanished", objectType])).toBe(0);
});

test("a signal carrying parameters and a return type is created", () => {
    const gtype = registerClass(uniqueName(), objectType, {
        signals: [
            {
                name: "gtkx-asked",
                paramTypes: [intType],
                returnType: booleanType,
                accumulator: "true-handled",
            },
        ],
    });

    expect(call(signalLookup, ["gtkx-asked", gtype])).toBeGreaterThan(0);
});

test("a subclass of an abstract registered type is constructible", () => {
    const parent = registerClass(uniqueName(), objectType, { abstract: true });
    const child = registerClass(uniqueName(), parent);

    expect(getType(construct(child).handle)).toBe(child);
});

test("constructing a registered type binds the wrapper and reports the registered GType", () => {
    const gtype = registerClass(uniqueName(), objectType);
    const { adopted, handle } = construct(gtype);

    expect(adopted).toBeNull();
    expect(getType(handle)).toBe(gtype);
});

test("constructing the plain GObject base type binds the wrapper too", () => {
    const { adopted, handle } = construct(objectType);

    expect(adopted).toBeNull();
    expect(getType(handle)).toBe(objectType);
});

test("construction hands the wrapper it was given to the associate callback", () => {
    const gtype = registerClass(uniqueName(), objectType);
    const wrapper = {};
    let received: unknown;

    newObject(gtype, [], [], wrapper, (_handle, bound) => {
        received = bound;
    });

    expect(received).toBe(wrapper);
});

test("a registered type binds its wrapper before its constructed vfunc runs", () => {
    const order: string[] = [];
    const gtype = registerClass(uniqueName(), objectType, {
        vfuncs: [
            {
                byteOffset: CONSTRUCTED_OFFSET,
                argDescriptors: [OBJECT],
                returnDescriptor: VOID,
                fn: () => {
                    order.push("constructed");
                },
            },
        ],
    });

    newObject(gtype, [], [], {}, () => {
        order.push("associate");
    });

    expect(order).toEqual(["associate", "constructed"]);
});

test("two constructions of the same type yield distinct instances", () => {
    const gtype = registerClass(uniqueName(), objectType);

    expect(construct(gtype).handle).not.toBe(construct(gtype).handle);
});

test("registering the same name twice throws", () => {
    const name = uniqueName();

    registerClass(name, objectType);

    expect(() => registerClass(name, objectType)).toThrow();
});

test("registering a type name containing a nul byte throws", () => {
    expect(() => registerClass("Gtkx\0Named", objectType)).toThrow();
});

test("registering with the invalid GType as a parent throws", () => {
    expect(() => registerClass(uniqueName(), 0n)).toThrow();
});

test("registering with a parent that has no class structure throws", () => {
    expect(() => registerClass(uniqueName(), closureType)).toThrow();
});

test("registering a property with a zero id throws", () => {
    expect(() =>
        registerClass(uniqueName(), objectType, { properties: [{ id: 0, pspec: intPspec("count") }] }),
    ).toThrow();
});

test("registering a signal the parent already carries throws", () => {
    expect(() => registerClass(uniqueName(), objectType, { signals: [{ name: "notify" }] })).toThrow();
});

test("registering the same signal twice on one class throws", () => {
    expect(() =>
        registerClass(uniqueName(), objectType, { signals: [{ name: "gtkx-twice" }, { name: "gtkx-twice" }] }),
    ).toThrow();
});

test("registering a signal whose name is not a valid signal name throws", () => {
    expect(() => registerClass(uniqueName(), objectType, { signals: [{ name: "1-bad" }] })).toThrow();
});

test("registering a signal with an unknown accumulator throws", () => {
    expect(() =>
        registerClass(uniqueName(), objectType, { signals: [{ name: "gtkx-odd", accumulator: "last-wins" }] }),
    ).toThrow();
});

test("registering a vfunc past the end of the class structure throws", () => {
    expect(() =>
        registerClass(uniqueName(), objectType, {
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
        registerClass(uniqueName(), objectType, {
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
        registerClass(uniqueName(), objectType, { interfaces: [{ type: objectType, vfuncs: [] }] }),
    ).toThrow();
});

test("registering interface vfuncs without a vtable size throws", () => {
    expect(() =>
        registerClass(uniqueName(), objectType, {
            interfaces: [
                {
                    type: typePluginType,
                    vfuncs: [{ byteOffset: 0, argDescriptors: [], returnDescriptor: VOID, fn: unreached }],
                },
            ],
        }),
    ).toThrow();
});

test("registering a css name on a parent that is not a widget throws", () => {
    expect(() => registerClass(uniqueName(), objectType, { cssName: "counter" })).toThrow();
});

test("constructing an abstract registered type throws", () => {
    const gtype = registerClass(uniqueName(), objectType, { abstract: true });

    expect(() => newObject(gtype, [], [], {}, ignore)).toThrow();
});

test("constructing the invalid GType throws", () => {
    expect(() => newObject(0n, [], [], {}, ignore)).toThrow();
});

test("constructing with more property names than values throws", () => {
    const gtype = registerClass(uniqueName(), objectType);

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

test("registering under a parent GType that names no registered type throws", () => {
    expect(() => registerClass(uniqueName(), 100n)).toThrow();
});

test("constructing a GType that names no registered type throws", () => {
    expect(() => newObject(100n, [], [], {}, ignore)).toThrow();
});

test("constructing with an unknown property name throws", () => {
    const gtype = registerClass(uniqueName(), objectType);

    expect(() => newObject(gtype, ["no-such-property"], [alloc(24)], {}, ignore)).toThrow();
});

test("constructing a registered type that is not instantiatable throws", () => {
    expect(() => newObject(closureType, [], [], {}, ignore)).toThrow();
});

test("constructing a not instantiatable type with properties throws", () => {
    expect(() => newObject(closureType, ["name"], [alloc(24)], {}, ignore)).toThrow();
});

test("constructing an instantiatable type that is not a GObject throws", () => {
    const paramType = call(typeFromName, ["GParamInt"]) as bigint;

    expect(() => newObject(paramType, ["name"], [alloc(VALUE_SIZE)], {}, ignore)).toThrow();
});
