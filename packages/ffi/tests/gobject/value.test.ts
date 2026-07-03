import {
    TYPE_BOOLEAN,
    TYPE_DOUBLE,
    TYPE_FLOAT,
    TYPE_INT,
    TYPE_INT64,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_VARIANT,
} from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import type { Type } from "@gtkx/gi/gobject";
import { ParamFlags, paramSpecBoolean, typeFromName, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";
import { getHandle, t } from "@gtkx/ffi";
import { resolveType } from "../../src/type.js";
import { fromValue, getValueType, newValueForDescriptor, toValue } from "../../src/value.js";

const callGetType = (lib: string, fn: string): Type => {
    const result = resolveType(lib, fn);
    if (typeof result !== "bigint") {
        throw new TypeError(`${fn} did not return a GType`);
    }
    return result;
};
const gdkRgbaGtype = (): Type => callGetType("libgtk-4.so.1", "gdk_rgba_get_type");

const makeRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA =>
    new (Gdk.RGBA as new (props: object) => Gdk.RGBA)({ red, green, blue, alpha });

describe("Value boxed accessors", () => {
    it("round-trips a boxed instance through setBoxed and getBoxed", () => {
        const value = new Value();
        value.init(gdkRgbaGtype());
        value.setBoxed(makeRgba(0.5, 0.25, 0.75, 1.0));

        const extracted = value.getBoxed<Gdk.RGBA>();
        expect(extracted).toBeInstanceOf(Gdk.RGBA);
        expect(extracted.red).toBeCloseTo(0.5);
        expect(extracted.green).toBeCloseTo(0.25);
        expect(extracted.blue).toBeCloseTo(0.75);
        expect(extracted.alpha).toBeCloseTo(1.0);
    });

    it("getBoxed returns null for a value that does not hold a boxed type", () => {
        const value = new Value();
        value.init(TYPE_STRING);
        value.setString("text");
        expect(value.getBoxed()).toBeNull();
    });

    it("getBoxed returns null when setBoxed was given null", () => {
        const value = new Value();
        value.init(gdkRgbaGtype());
        value.setBoxed(null);
        expect(value.getBoxed()).toBeNull();
    });
});

describe("toValue — gobject", () => {
    it("creates a GValue holding a GObject", () => {
        const label = new Gtk.Label({ label: "test" });
        const v = toValue({ kind: "object", ownership: "borrowed" }, label);
        expect(fromValue(v)).not.toBeNull();
    });

    it("creates a GValue holding null", () => {
        const v = toValue({ kind: "object", ownership: "borrowed" }, null);
        expect(fromValue(v)).toBeNull();
    });
});

describe("getValueType", () => {
    it("returns the GType of a string value", () => {
        expect(getValueType(toValue({ kind: "string", ownership: "borrowed" }, "test"))).toBe(TYPE_STRING);
    });

    it("returns the GType of a boolean value", () => {
        expect(getValueType(toValue({ kind: "boolean" }, true))).toBe(TYPE_BOOLEAN);
    });

    it("returns the GType of an int value", () => {
        expect(getValueType(toValue({ kind: "int32" }, 42))).toBe(TYPE_INT);
    });
});

describe("fromValue extra coverage", () => {
    it("returns null when reading a default-initialized G_TYPE_POINTER", () => {
        const v = new Value();
        v.init(TYPE_POINTER);
        expect(fromValue(getHandle(v))).toBeNull();
    });

    it("returns an empty array when reading an unset GStrv value", () => {
        const v = new Value();
        v.init(typeFromName("GStrv"));
        expect(fromValue(getHandle(v))).toEqual([]);
    });

    it("returns a Gdk.RGBA wrapper when reading a boxed value", () => {
        const v = new Value();
        v.init(gdkRgbaGtype());
        v.setBoxed(makeRgba(0.1, 0.2, 0.3, 1.0));
        expect(fromValue(getHandle(v))).toBeInstanceOf(Gdk.RGBA);
    });
});

describe("toValue — primitives", () => {
    it("builds a boolean value", () => {
        expect(fromValue(toValue({ kind: "boolean" }, true))).toBe(true);
    });

    it("builds a string value", () => {
        expect(fromValue(toValue({ kind: "string", ownership: "borrowed" }, "hi"))).toBe("hi");
    });

    it("builds an int value for int8/int16/int32 descriptors", () => {
        expect(fromValue(toValue({ kind: "int8" }, -1))).toBe(-1);
        expect(fromValue(toValue({ kind: "int16" }, 100))).toBe(100);
        expect(fromValue(toValue({ kind: "int32" }, 2000))).toBe(2000);
    });

    it("builds a uint value for uint8/uint16/uint32 descriptors", () => {
        expect(fromValue(toValue({ kind: "uint8" }, 1))).toBe(1);
        expect(fromValue(toValue({ kind: "uint16" }, 200))).toBe(200);
        expect(fromValue(toValue({ kind: "uint32" }, 4000))).toBe(4000);
    });

    it("builds int64 and uint64 values as bigint", () => {
        expect(fromValue(toValue({ kind: "bigint64" }, 42n))).toBe(42n);
        expect(fromValue(toValue({ kind: "biguint64" }, 84n))).toBe(84n);
    });

    it("builds float and double values", () => {
        expect(fromValue(toValue({ kind: "float32" }, 1.5))).toBeCloseTo(1.5, 3);
        expect(fromValue(toValue({ kind: "float64" }, Math.PI))).toBeCloseTo(Math.PI);
    });
});

describe("toValue — enums and flags", () => {
    it("builds an enum value from library/getTypeFnName descriptor", () => {
        const v = toValue(
            { kind: "enum", sharedLibrary: "libgtk-4.so.1", getTypeFnName: "gtk_align_get_type", signed: false },
            Gtk.Align.CENTER,
        );
        expect(fromValue(v)).toBe(Gtk.Align.CENTER);
    });

    it("builds a flags value from a flags-fundamental enum descriptor", () => {
        const v = toValue(
            {
                kind: "enum",
                sharedLibrary: "libgobject-2.0.so.0",
                getTypeFnName: "g_binding_flags_get_type",
                signed: false,
            },
            3,
        );
        expect(fromValue(v)).toBe(3);
    });

    it("builds a flags value from a flags descriptor", () => {
        const v = toValue(
            {
                kind: "flags",
                sharedLibrary: "libgobject-2.0.so.0",
                getTypeFnName: "g_binding_flags_get_type",
                signed: false,
            },
            5,
        );
        expect(fromValue(v)).toBe(5);
    });
});

describe("toValue — objects and boxed", () => {
    it("builds a gobject value", () => {
        const label = new Gtk.Label({ label: "x" });
        expect(fromValue(toValue({ kind: "object", ownership: "borrowed" }, label))).not.toBeNull();
    });

    it("builds a boxed value via getTypeFnName resolution", () => {
        const v = toValue(
            {
                kind: "boxed",
                ownership: "borrowed",
                typeName: "GdkRGBA",
                sharedLibrary: "libgtk-4.so.1",
                getTypeFnName: "gdk_rgba_get_type",
            },
            makeRgba(0, 0, 0, 1),
        );
        expect(getValueType(v)).toBe(gdkRgbaGtype());
    });

    it("builds a boxed value when only typeName is provided", () => {
        const v = toValue({ kind: "boxed", ownership: "borrowed", typeName: "GdkRGBA" }, makeRgba(0, 0, 0, 1));
        expect(getValueType(v)).toBe(gdkRgbaGtype());
    });

    it("throws for boxed types with an unresolvable typeName", () => {
        expect(() =>
            toValue({ kind: "boxed", ownership: "borrowed", typeName: "NotARealGType" }, makeRgba(0, 0, 0, 1)),
        ).toThrow(/Cannot resolve gtype/);
    });
});

describe("toValue — variant and param fundamentals", () => {
    it("round-trips a GVariant through a fundamental descriptor keyed by typeName", () => {
        const variant = GLib.Variant.newString("payload");
        const descriptor = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
            ownership: "borrowed",
            typeName: "GVariant",
        });

        const value = toValue(descriptor, variant);
        expect(getValueType(value)).toBe(TYPE_VARIANT);

        const result = fromValue(value);
        expect(result).toBeInstanceOf(GLib.Variant);
        expect((result as GLib.Variant).getString()[0]).toBe("payload");
    });

    it("marshals a GParamSpec through the PARAM fundamental, not the boxed path", () => {
        const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
        const descriptor = t.fundamental("libgobject-2.0.so.0", "g_param_spec_ref", "g_param_spec_unref", {
            ownership: "borrowed",
            typeName: "GParam",
        });

        const value = toValue(descriptor, spec);
        expect(getValueType(value)).toBe(TYPE_PARAM);

        const result = fromValue(value) as typeof spec | null;
        expect(result?.getName()).toBe(spec.getName());
    });
});

describe("toValue — arrays and errors", () => {
    it("builds a strv array value", () => {
        const v = toValue(
            {
                kind: "array",
                arrayKind: "array",
                ownership: "borrowed",
                itemDescriptor: { kind: "string", ownership: "borrowed" },
            },
            ["one", "two"],
        );
        expect(fromValue(v)).toEqual(["one", "two"]);
    });

    it("throws for unsupported array types", () => {
        expect(() =>
            toValue(
                {
                    kind: "array",
                    arrayKind: "glist",
                    ownership: "borrowed",
                    itemDescriptor: { kind: "string", ownership: "borrowed" },
                },
                ["x"],
            ),
        ).toThrow(/unsupported array type/i);
    });

    it("throws for fundamental types without a typeName", () => {
        expect(() =>
            toValue(
                {
                    kind: "fundamental",
                    ownership: "borrowed",
                    sharedLibrary: "libgobject-2.0.so.0",
                    refFnName: "g_object_ref",
                    unrefFnName: "g_object_unref",
                },
                makeRgba(0, 0, 0, 1),
            ),
        ).toThrow(/Cannot resolve gtype for fundamental/);
    });

    it("throws for unsupported type descriptors", () => {
        expect(() => toValue({ kind: "unichar" }, 0)).toThrow(/unsupported type descriptor/i);
    });
});

const gtypeOfEmpty = (ffi: Parameters<typeof newValueForDescriptor>[0]): Type =>
    getValueType(newValueForDescriptor(ffi));
const gdkRgbaFfi = {
    kind: "boxed",
    ownership: "borrowed",
    typeName: "GdkRGBA",
    sharedLibrary: "libgtk-4.so.1",
    getTypeFnName: "gdk_rgba_get_type",
} as const;
const variantFfi = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const strvFfi = {
    kind: "array",
    arrayKind: "array",
    ownership: "borrowed",
    itemDescriptor: { kind: "string", ownership: "borrowed" },
} as const;

describe("newValueForDescriptor — GType resolution from an FFI descriptor", () => {
    it("resolves primitive descriptors to their fundamental GType", () => {
        expect(gtypeOfEmpty({ kind: "boolean" })).toBe(TYPE_BOOLEAN);
        expect(gtypeOfEmpty({ kind: "string", ownership: "borrowed" })).toBe(TYPE_STRING);
        expect(gtypeOfEmpty({ kind: "int8" })).toBe(TYPE_INT);
        expect(gtypeOfEmpty({ kind: "int16" })).toBe(TYPE_INT);
        expect(gtypeOfEmpty({ kind: "int32" })).toBe(TYPE_INT);
        expect(gtypeOfEmpty({ kind: "uint8" })).toBe(TYPE_UINT);
        expect(gtypeOfEmpty({ kind: "uint16" })).toBe(TYPE_UINT);
        expect(gtypeOfEmpty({ kind: "uint32" })).toBe(TYPE_UINT);
        expect(gtypeOfEmpty({ kind: "int64" })).toBe(TYPE_INT64);
        expect(gtypeOfEmpty({ kind: "uint64" })).toBe(TYPE_UINT64);
        expect(gtypeOfEmpty({ kind: "float32" })).toBe(TYPE_FLOAT);
        expect(gtypeOfEmpty({ kind: "float64" })).toBe(TYPE_DOUBLE);
        expect(gtypeOfEmpty({ kind: "object", ownership: "borrowed" })).toBe(TYPE_OBJECT);
    });

    it("resolves enum and flags descriptors through their get-type", () => {
        const align = {
            kind: "enum",
            sharedLibrary: "libgtk-4.so.1",
            getTypeFnName: "gtk_align_get_type",
            signed: false,
        } as const;
        const flags = {
            kind: "flags",
            sharedLibrary: "libgobject-2.0.so.0",
            getTypeFnName: "g_binding_flags_get_type",
            signed: false,
        } as const;
        expect(gtypeOfEmpty(align)).toBe(callGetType("libgtk-4.so.1", "gtk_align_get_type"));
        expect(gtypeOfEmpty(flags)).toBe(callGetType("libgobject-2.0.so.0", "g_binding_flags_get_type"));
    });

    it("resolves boxed and variant-fundamental descriptors", () => {
        expect(gtypeOfEmpty(gdkRgbaFfi)).toBe(gdkRgbaGtype());
        expect(gtypeOfEmpty(variantFfi)).toBe(TYPE_VARIANT);
    });

    it("resolves a string-array descriptor to GStrv", () => {
        expect(gtypeOfEmpty(strvFfi)).toBe(typeFromName("GStrv"));
    });

    it("throws for unsupported descriptors", () => {
        expect(() => newValueForDescriptor({ ...strvFfi, arrayKind: "glist" })).toThrow(/unsupported array type/i);
        expect(() => newValueForDescriptor({ kind: "unichar" })).toThrow(/unsupported type descriptor/i);
    });
});
