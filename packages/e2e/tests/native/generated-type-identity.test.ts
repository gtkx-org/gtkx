import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { alloc, getType, getTypeClass, read } from "@gtkx/native";
import { getClassType, getHandle, registerClass } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

Gtk.init();
drainAfterEachTest();

const OBJECT_TYPE = getClassType(GObject.Object);
const GROUP_TYPE = getClassType(GObject.BindingGroup);
const CLOSURE_TYPE = getClassType(GObject.Closure);
const PLUGIN_TYPE = getClassType(GObject.TypePlugin);
const ENUM_TYPE = GObject.ObjectClass.peek(Gtk.Box).findProperty("orientation").valueType;
const FUNDAMENTAL_ENUM_TYPE = GObject.typeFundamental(ENUM_TYPE);
const PARAM_TYPE = getClassType(GObject.ParamSpec);
const PARAM_INT_TYPE = getClassType(GObject.ParamSpecInt);
const Subject = registerClass(class extends GObject.Object {}, { typeName: "GtkxGeneratedTypeIdentitySubject" });
const SUBTYPE = getClassType(Subject);
const newParamSpec = () => {
    const spec = GObject.paramSpecInt("subject-int", null, null, 0, 10, 5, GObject.ParamFlags.READWRITE);

    return getHandle(spec);
};
const newGroupHandle = () => getHandle(new GObject.BindingGroup({}));
const classTypeTag = (gtype: bigint): unknown => read(getTypeClass(gtype), { kind: "biguint64" }, 0);

test("a constructed instance reports the type it was constructed as", () => {
    expect(getType(newGroupHandle())).toBe(GROUP_TYPE);
});

test("the reported type names the instance back through the library it came from", () => {
    const gtype = getType(newGroupHandle());

    expect(GObject.typeName(gtype)).toEqual("GBindingGroup");
});

test("an instance of a runtime registered subtype reports the subtype", () => {
    const instance = new Subject({});
    expect(getType(getHandle(instance))).toBe(SUBTYPE);
});

test("instances of different types report different types", () => {
    const signalGroup = GObject.SignalGroup.new(GObject.Object);
    expect(getType(newGroupHandle())).not.toBe(getType(getHandle(signalGroup)));
});

test("a fundamental instance reports the type it was declared as", () => {
    expect(getType(newParamSpec(), PARAM_INT_TYPE)).toBe(PARAM_INT_TYPE);
});

test("a fundamental instance reports its own leaf type when an ancestor is declared", () => {
    const gtype = getType(newParamSpec(), PARAM_TYPE);

    expect(GObject.typeName(gtype)).toEqual("GParamInt");
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

test("a class struct handle carries no type tag", () => {
    expect(getType(getTypeClass(OBJECT_TYPE))).toBe(0n);
});

test("an object instance reports its own type whatever type is declared", () => {
    expect(getType(newGroupHandle(), CLOSURE_TYPE)).toBe(GROUP_TYPE);
});

test("a declared type on a handle with no type tag still yields no type", () => {
    expect(getType(alloc(64), GROUP_TYPE)).toBe(0n);
});

test("the invalid declared type throws", () => {
    expect(() => getType(newGroupHandle(), 0n)).toThrow();
});

test("a negative declared type throws", () => {
    expect(() => getType(newGroupHandle(), -1n)).toThrow();
});

test("a declared type beyond the 64-bit range throws", () => {
    expect(() => getType(newGroupHandle(), 2n ** 64n)).toThrow();
});

test("a type's class struct is tagged with that type", () => {
    expect(classTypeTag(OBJECT_TYPE)).toBe(OBJECT_TYPE);
});

test("a class struct is a live class the library resolves back to its parent", () => {
    const parent = getHandle(GObject.TypeClass.get(GObject.BindingGroup).peekParent());

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

test("a boxed type has no class and throws", () => {
    expect(() => getTypeClass(CLOSURE_TYPE)).toThrow();
});

test("an interface type has no class and throws", () => {
    expect(() => getTypeClass(PLUGIN_TYPE)).toThrow();
});
