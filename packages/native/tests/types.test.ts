import {
    alloc,
    bind,
    call,
    type ExternalObject,
    getType,
    getTypeClass,
    type Handle,
    read,
    registerClass,
    resolveType,
} from "@gtkx/native";
import { expect, test } from "vitest";

const GOBJECT = "libgobject-2.0.so.0";

const typeName = bind(GOBJECT, "g_type_name", [{ kind: "biguint64" }], { kind: "string", ownership: "borrowed" });
const typeFundamental = bind(GOBJECT, "g_type_fundamental", [{ kind: "biguint64" }], { kind: "biguint64" });

const typeFromName = bind(GOBJECT, "g_type_from_name", [{ kind: "string", ownership: "borrowed" }], {
    kind: "biguint64",
});

const classPeekParent = bind(GOBJECT, "g_type_class_peek_parent", [{ kind: "struct", ownership: "borrowed" }], {
    kind: "struct",
    ownership: "borrowed",
});

const objectNew = bind(
    GOBJECT,
    "g_object_new_with_properties",
    [
        { kind: "biguint64" },
        { kind: "uint32" },
        {
            kind: "array",
            itemDescriptor: { kind: "string", ownership: "borrowed" },
            arrayKind: "array",
            ownership: "borrowed",
            isZeroTerminated: true,
        },
        {
            kind: "array",
            itemDescriptor: { kind: "struct", ownership: "borrowed", size: 24 },
            arrayKind: "array",
            ownership: "borrowed",
            sizeParamIndex: 1,
        },
    ],
    { kind: "object", ownership: "full" },
);

const paramSpecInt = bind(
    GOBJECT,
    "g_param_spec_int",
    [
        { kind: "string", ownership: "borrowed" },
        { kind: "string", ownership: "borrowed" },
        { kind: "string", ownership: "borrowed" },
        { kind: "int32" },
        { kind: "int32" },
        { kind: "int32" },
        { kind: "uint32" },
    ],
    {
        kind: "fundamental",
        ownership: "full",
        sharedLibrary: GOBJECT,
        refFnName: "g_param_spec_ref",
        unrefFnName: "g_param_spec_unref",
        typeName: "GParamSpec",
    },
);

const OBJECT_TYPE = resolveType(GOBJECT, "g_object_get_type");
const GROUP_TYPE = resolveType(GOBJECT, "g_binding_group_get_type");
const SIGNAL_GROUP_TYPE = resolveType(GOBJECT, "g_signal_group_get_type");
const CLOSURE_TYPE = resolveType(GOBJECT, "g_closure_get_type");
const PLUGIN_TYPE = resolveType(GOBJECT, "g_type_plugin_get_type");
const ENUM_TYPE = resolveType(GOBJECT, "g_normalize_mode_get_type");
const FUNDAMENTAL_ENUM_TYPE = call(typeFundamental, [ENUM_TYPE]) as bigint;
const PARAM_TYPE = call(typeFromName, ["GParam"]) as bigint;
const PARAM_INT_TYPE = call(typeFromName, ["GParamInt"]) as bigint;
const SUBTYPE = registerClass("GtkxNativeTypesSubject", OBJECT_TYPE);

const newInstance = (gtype: bigint): ExternalObject<Handle> =>
    call(objectNew, [gtype, 0, null, null]) as ExternalObject<Handle>;

const newParamSpec = (): ExternalObject<Handle> =>
    call(paramSpecInt, ["subject-int", null, null, 0, 10, 5, 3]) as ExternalObject<Handle>;

const classTypeTag = (gtype: bigint): unknown => read(getTypeClass(gtype), { kind: "biguint64" }, 0);

test("a constructed instance reports the type it was constructed as", () => {
    expect(getType(newInstance(GROUP_TYPE))).toBe(GROUP_TYPE);
});

test("the reported type names the instance back through the library it came from", () => {
    const gtype = getType(newInstance(GROUP_TYPE));

    expect(call(typeName, [gtype])).toBe("GBindingGroup");
});

test("an instance of a runtime registered subtype reports the subtype", () => {
    expect(getType(newInstance(SUBTYPE))).toBe(SUBTYPE);
});

test("instances of different types report different types", () => {
    expect(getType(newInstance(GROUP_TYPE))).not.toBe(getType(newInstance(SIGNAL_GROUP_TYPE)));
});

test("a fundamental instance reports the type it was declared as", () => {
    expect(getType(newParamSpec(), PARAM_INT_TYPE)).toBe(PARAM_INT_TYPE);
});

test("a fundamental instance reports its own leaf type when an ancestor is declared", () => {
    const gtype = getType(newParamSpec(), PARAM_TYPE);

    expect(call(typeName, [gtype])).toBe("GParamInt");
});

test("a fundamental instance with no declared type reports no type", () => {
    expect(getType(newParamSpec())).toBe(0n);
});

test("a fundamental instance declared as a type it does not descend from reports no type", () => {
    expect(getType(newParamSpec(), OBJECT_TYPE)).toBe(0n);
});

test("a fundamental instance declared as a type that is not instantiatable reports no type", () => {
    expect(getType(newParamSpec(), CLOSURE_TYPE)).toBe(0n);
});

test("a handle over plain allocated memory carries no type tag", () => {
    expect(getType(alloc(64))).toBe(0n);
});

test("a class struct handle carries no type tag", () => {
    expect(getType(getTypeClass(OBJECT_TYPE))).toBe(0n);
});

test("an object instance reports its own type whatever type is declared", () => {
    expect(getType(newInstance(GROUP_TYPE), CLOSURE_TYPE)).toBe(GROUP_TYPE);
});

test("a declared type on a handle with no type tag still yields no type", () => {
    expect(getType(alloc(64), GROUP_TYPE)).toBe(0n);
});

test("the invalid declared type throws", () => {
    expect(() => getType(newInstance(GROUP_TYPE), 0n)).toThrow();
});

test("a negative declared type throws", () => {
    expect(() => getType(newInstance(GROUP_TYPE), -1n)).toThrow();
});

test("a declared type beyond the 64-bit range throws", () => {
    expect(() => getType(newInstance(GROUP_TYPE), 2n ** 64n)).toThrow();
});

test("a type's class struct is tagged with that type", () => {
    expect(classTypeTag(OBJECT_TYPE)).toBe(OBJECT_TYPE);
});

test("a class struct is a live class the library resolves back to its parent", () => {
    const parent = call(classPeekParent, [getTypeClass(GROUP_TYPE)]) as ExternalObject<Handle>;

    expect(read(parent, { kind: "biguint64" }, 0)).toBe(OBJECT_TYPE);
});

test("a derived object type gets its own class struct rather than its parent's", () => {
    expect(classTypeTag(GROUP_TYPE)).toBe(GROUP_TYPE);
});

test("a runtime registered subtype gets a class struct tagged with the registered type", () => {
    expect(classTypeTag(SUBTYPE)).toBe(SUBTYPE);
});

test("a classed fundamental type gets a class struct tagged with the fundamental itself", () => {
    expect(classTypeTag(FUNDAMENTAL_ENUM_TYPE)).toBe(FUNDAMENTAL_ENUM_TYPE);
});

test("an enumeration type gets a class struct tagged with the derived type", () => {
    expect(classTypeTag(ENUM_TYPE)).toBe(ENUM_TYPE);
});

test("the invalid GType throws", () => {
    expect(() => getTypeClass(0n)).toThrow();
});

test("a boxed type has no class and throws", () => {
    expect(() => getTypeClass(CLOSURE_TYPE)).toThrow();
});

test("an interface type has no class and throws", () => {
    expect(() => getTypeClass(PLUGIN_TYPE)).toThrow();
});

test("a negative GType throws", () => {
    expect(() => getTypeClass(-1n)).toThrow();
});

test("a GType beyond the 64-bit range throws", () => {
    expect(() => getTypeClass(2n ** 64n)).toThrow();
});

test("a GType in the fundamental range that names no registered type throws", () => {
    expect(() => getTypeClass(100n)).toThrow();
});

test("the last GType of the fundamental range throws when nothing registered it", () => {
    expect(() => getTypeClass(1020n)).toThrow();
});
