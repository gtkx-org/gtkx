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
import type { GType } from "@gtkx/gi/gobject";
import { ParamFlags, paramSpecBoolean, typeFromName, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";
import { getHandle, t } from "@gtkx/ffi";
import { call } from "@gtkx/native";
import {
    fromGvalue,
    newValueFromFfi,
    toGvalue,
    valueGetBoolean,
    valueGetDouble,
    valueGetEnum,
    valueGetFlags,
    valueGetFloat,
    valueGetInt,
    valueGetInt64,
    valueGetObject,
    valueGetString,
    valueGetType,
    valueGetUint,
    valueGetUint64,
} from "../../src/gvalue.js";

const callGetType = (lib: string, fn: string): GType => {
    const result = call(lib, fn, [], { type: "biguint64" });
    if (typeof result !== "bigint") {
        throw new TypeError(`${fn} did not return a GType`);
    }
    return result;
};
const gdkRgbaGtype = (): GType => callGetType("libgtk-4.so.1", "gdk_rgba_get_type");

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

describe("toGvalue — gobject", () => {
    it("creates a GValue holding a GObject", () => {
        const label = new Gtk.Label({ label: "test" });
        const v = toGvalue({ type: "gobject", ownership: "borrowed" }, label);
        expect(valueGetObject(v)).not.toBeNull();
    });

    it("creates a GValue holding null", () => {
        const v = toGvalue({ type: "gobject", ownership: "borrowed" }, null);
        expect(valueGetObject(v)).toBeNull();
    });
});

describe("valueGetType", () => {
    it("returns the GType of a string value", () => {
        expect(valueGetType(toGvalue({ type: "string", ownership: "borrowed" }, "test"))).toBe(TYPE_STRING);
    });

    it("returns the GType of a boolean value", () => {
        expect(valueGetType(toGvalue({ type: "boolean" }, true))).toBe(TYPE_BOOLEAN);
    });

    it("returns the GType of an int value", () => {
        expect(valueGetType(toGvalue({ type: "int32" }, 42))).toBe(TYPE_INT);
    });
});

describe("fromGvalue extra coverage", () => {
    it("returns null when reading a default-initialized G_TYPE_POINTER", () => {
        const v = new Value();
        v.init(TYPE_POINTER);
        expect(fromGvalue(getHandle(v))).toBeNull();
    });

    it("returns an empty array when reading an unset GStrv value", () => {
        const v = new Value();
        v.init(typeFromName("GStrv"));
        expect(fromGvalue(getHandle(v))).toEqual([]);
    });

    it("returns a Gdk.RGBA wrapper when reading a boxed value", () => {
        const v = new Value();
        v.init(gdkRgbaGtype());
        v.setBoxed(makeRgba(0.1, 0.2, 0.3, 1.0));
        expect(fromGvalue(getHandle(v))).toBeInstanceOf(Gdk.RGBA);
    });
});

describe("toGvalue — primitives", () => {
    it("builds a boolean value", () => {
        expect(valueGetBoolean(toGvalue({ type: "boolean" }, true))).toBe(true);
    });

    it("builds a string value", () => {
        expect(valueGetString(toGvalue({ type: "string", ownership: "borrowed" }, "hi"))).toBe("hi");
    });

    it("builds an int value for int8/int16/int32 descriptors", () => {
        expect(valueGetInt(toGvalue({ type: "int8" }, -1))).toBe(-1);
        expect(valueGetInt(toGvalue({ type: "int16" }, 100))).toBe(100);
        expect(valueGetInt(toGvalue({ type: "int32" }, 2000))).toBe(2000);
    });

    it("builds a uint value for uint8/uint16/uint32 descriptors", () => {
        expect(valueGetUint(toGvalue({ type: "uint8" }, 1))).toBe(1);
        expect(valueGetUint(toGvalue({ type: "uint16" }, 200))).toBe(200);
        expect(valueGetUint(toGvalue({ type: "uint32" }, 4000))).toBe(4000);
    });

    it("builds int64 and uint64 values as bigint", () => {
        expect(valueGetInt64(toGvalue({ type: "bigint64" }, 42n))).toBe(42n);
        expect(valueGetUint64(toGvalue({ type: "biguint64" }, 84n))).toBe(84n);
    });

    it("builds float and double values", () => {
        expect(valueGetFloat(toGvalue({ type: "float32" }, 1.5))).toBeCloseTo(1.5, 3);
        expect(valueGetDouble(toGvalue({ type: "float64" }, Math.PI))).toBeCloseTo(Math.PI);
    });
});

describe("toGvalue — enums and flags", () => {
    it("builds an enum value from library/getTypeFn descriptor", () => {
        const v = toGvalue(
            { type: "enum", library: "libgtk-4.so.1", getTypeFn: "gtk_align_get_type", signed: false },
            Gtk.Align.CENTER,
        );
        expect(valueGetEnum(v)).toBe(Gtk.Align.CENTER);
    });

    it("builds a flags value from a flags-fundamental enum descriptor", () => {
        const v = toGvalue(
            { type: "enum", library: "libgobject-2.0.so.0", getTypeFn: "g_binding_flags_get_type", signed: false },
            3,
        );
        expect(valueGetFlags(v)).toBe(3);
    });

    it("builds a flags value from a flags descriptor", () => {
        const v = toGvalue(
            { type: "flags", library: "libgobject-2.0.so.0", getTypeFn: "g_binding_flags_get_type", signed: false },
            5,
        );
        expect(valueGetFlags(v)).toBe(5);
    });
});

describe("toGvalue — objects and boxed", () => {
    it("builds a gobject value", () => {
        const label = new Gtk.Label({ label: "x" });
        expect(valueGetObject(toGvalue({ type: "gobject", ownership: "borrowed" }, label))).not.toBeNull();
    });

    it("builds a boxed value via getTypeFn resolution", () => {
        const v = toGvalue(
            {
                type: "boxed",
                ownership: "borrowed",
                innerType: "GdkRGBA",
                library: "libgtk-4.so.1",
                getTypeFn: "gdk_rgba_get_type",
            },
            makeRgba(0, 0, 0, 1),
        );
        expect(valueGetType(v)).toBe(gdkRgbaGtype());
    });

    it("builds a boxed value when only innerType is provided", () => {
        const v = toGvalue({ type: "boxed", ownership: "borrowed", innerType: "GdkRGBA" }, makeRgba(0, 0, 0, 1));
        expect(valueGetType(v)).toBe(gdkRgbaGtype());
    });

    it("throws for boxed types with an unresolvable innerType", () => {
        expect(() =>
            toGvalue({ type: "boxed", ownership: "borrowed", innerType: "NotARealGType" }, makeRgba(0, 0, 0, 1)),
        ).toThrow(/Cannot resolve gtype/);
    });
});

describe("toGvalue — variant and param fundamentals", () => {
    it("round-trips a GVariant through a fundamental descriptor keyed by typeName", () => {
        const variant = GLib.Variant.newString("payload");
        const descriptor = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
            ownership: "borrowed",
            typeName: "GVariant",
        });

        const value = toGvalue(descriptor, variant);
        expect(valueGetType(value)).toBe(TYPE_VARIANT);

        const result = fromGvalue(value);
        expect(result).toBeInstanceOf(GLib.Variant);
        expect((result as GLib.Variant).getString()[0]).toBe("payload");
    });

    it("marshals a GParamSpec through the PARAM fundamental, not the boxed path", () => {
        const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
        const descriptor = t.fundamental("libgobject-2.0.so.0", "g_param_spec_ref", "g_param_spec_unref", {
            ownership: "borrowed",
            typeName: "GParam",
        });

        const value = toGvalue(descriptor, spec);
        expect(valueGetType(value)).toBe(TYPE_PARAM);

        const result = fromGvalue(value) as typeof spec | null;
        expect(result?.getName()).toBe(spec.getName());
    });
});

describe("toGvalue — arrays and errors", () => {
    it("builds a strv array value", () => {
        const v = toGvalue(
            {
                type: "array",
                kind: "array",
                ownership: "borrowed",
                itemType: { type: "string", ownership: "borrowed" },
            },
            ["one", "two"],
        );
        expect(fromGvalue(v)).toEqual(["one", "two"]);
    });

    it("throws for unsupported array types", () => {
        expect(() =>
            toGvalue(
                {
                    type: "array",
                    kind: "glist",
                    ownership: "borrowed",
                    itemType: { type: "string", ownership: "borrowed" },
                },
                ["x"],
            ),
        ).toThrow(/unsupported array type/i);
    });

    it("throws for fundamental types without a typeName", () => {
        expect(() =>
            toGvalue(
                {
                    type: "fundamental",
                    ownership: "borrowed",
                    library: "libgobject-2.0.so.0",
                    refFn: "g_object_ref",
                    unrefFn: "g_object_unref",
                },
                makeRgba(0, 0, 0, 1),
            ),
        ).toThrow(/Cannot resolve gtype for fundamental/);
    });

    it("throws for unsupported FFI types", () => {
        expect(() => toGvalue({ type: "unichar" }, 0)).toThrow(/unsupported FFI type/i);
    });
});

const gtypeOfEmpty = (ffi: Parameters<typeof newValueFromFfi>[0]): GType => valueGetType(newValueFromFfi(ffi));
const gdkRgbaFfi = {
    type: "boxed",
    ownership: "borrowed",
    innerType: "GdkRGBA",
    library: "libgtk-4.so.1",
    getTypeFn: "gdk_rgba_get_type",
} as const;
const variantFfi = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const strvFfi = {
    type: "array",
    kind: "array",
    ownership: "borrowed",
    itemType: { type: "string", ownership: "borrowed" },
} as const;

describe("newValueFromFfi — GType resolution from an FFI descriptor", () => {
    it("resolves primitive descriptors to their fundamental GType", () => {
        expect(gtypeOfEmpty({ type: "boolean" })).toBe(TYPE_BOOLEAN);
        expect(gtypeOfEmpty({ type: "string", ownership: "borrowed" })).toBe(TYPE_STRING);
        expect(gtypeOfEmpty({ type: "int8" })).toBe(TYPE_INT);
        expect(gtypeOfEmpty({ type: "int16" })).toBe(TYPE_INT);
        expect(gtypeOfEmpty({ type: "int32" })).toBe(TYPE_INT);
        expect(gtypeOfEmpty({ type: "uint8" })).toBe(TYPE_UINT);
        expect(gtypeOfEmpty({ type: "uint16" })).toBe(TYPE_UINT);
        expect(gtypeOfEmpty({ type: "uint32" })).toBe(TYPE_UINT);
        expect(gtypeOfEmpty({ type: "int64" })).toBe(TYPE_INT64);
        expect(gtypeOfEmpty({ type: "uint64" })).toBe(TYPE_UINT64);
        expect(gtypeOfEmpty({ type: "float32" })).toBe(TYPE_FLOAT);
        expect(gtypeOfEmpty({ type: "float64" })).toBe(TYPE_DOUBLE);
        expect(gtypeOfEmpty({ type: "gobject", ownership: "borrowed" })).toBe(TYPE_OBJECT);
    });

    it("resolves enum and flags descriptors through their get-type", () => {
        const align = {
            type: "enum",
            library: "libgtk-4.so.1",
            getTypeFn: "gtk_align_get_type",
            signed: false,
        } as const;
        const flags = {
            type: "flags",
            library: "libgobject-2.0.so.0",
            getTypeFn: "g_binding_flags_get_type",
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
        expect(() => newValueFromFfi({ ...strvFfi, kind: "glist" })).toThrow(/unsupported array type/i);
        expect(() => newValueFromFfi({ type: "unichar" })).toThrow(/unsupported FFI type/i);
    });
});
