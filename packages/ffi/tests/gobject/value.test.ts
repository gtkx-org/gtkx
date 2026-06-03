import { Type } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import type { GType } from "@gtkx/gi/gobject";
import { ParamFlags, paramSpecBoolean, typeFromName, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";
import { t, valueFromFfi, valueFromJS, valueFromObject, valueGetType, valueToJS } from "@gtkx/ffi";
import { call } from "@gtkx/native";

const callGetType = (lib: string, fn: string): GType => {
    const result = call(lib, fn, [], { type: "uint64" });
    if (typeof result !== "number") {
        throw new TypeError(`${fn} did not return a GType`);
    }
    return result;
};
const gdkRgbaGType = (): GType => callGetType("libgtk-4.so.1", "gdk_rgba_get_type");

const makeRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA =>
    new (Gdk.RGBA as new (props: object) => Gdk.RGBA)({ red, green, blue, alpha });

describe("Value boxed accessors", () => {
    it("round-trips a boxed instance through setBoxed and getBoxed", () => {
        const value = new Value();
        value.init(gdkRgbaGType());
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
        value.init(Type.STRING);
        value.setString("text");
        expect(value.getBoxed()).toBeNull();
    });

    it("getBoxed returns null when setBoxed was given null", () => {
        const value = new Value();
        value.init(gdkRgbaGType());
        value.setBoxed(null);
        expect(value.getBoxed()).toBeNull();
    });
});

describe("valueFromObject", () => {
    it("creates a GValue holding a GObject", () => {
        const label = new Gtk.Label({ label: "test" });
        const v = valueFromObject(label);
        expect(v.getObject()).not.toBeNull();
    });

    it("creates a GValue holding null", () => {
        const v = valueFromObject(null);
        expect(v.getObject()).toBeNull();
    });
});

describe("valueGetType", () => {
    it("returns the GType of a string value", () => {
        expect(valueGetType(valueFromJS(Type.STRING, "test"))).toBe(Type.STRING);
    });

    it("returns the GType of a boolean value", () => {
        expect(valueGetType(valueFromJS(Type.BOOLEAN, true))).toBe(Type.BOOLEAN);
    });

    it("returns the GType of an int value", () => {
        expect(valueGetType(valueFromJS(Type.INT, 42))).toBe(Type.INT);
    });
});

describe("valueFromJS / valueToJS round-trips — primitives", () => {
    it("round-trips a boolean", () => {
        expect(valueToJS(valueFromJS(Type.BOOLEAN, true))).toBe(true);
        expect(valueToJS(valueFromJS(Type.BOOLEAN, false))).toBe(false);
    });

    it("round-trips signed and unsigned integers", () => {
        expect(valueToJS(valueFromJS(Type.INT, -42))).toBe(-42);
        expect(valueToJS(valueFromJS(Type.UINT, 255))).toBe(255);
        expect(valueToJS(valueFromJS(Type.LONG, 100_000))).toBe(100_000);
        expect(valueToJS(valueFromJS(Type.ULONG, 200_000))).toBe(200_000);
        expect(valueToJS(valueFromJS(Type.INT64, 9_007_199_254_740_991))).toBe(9_007_199_254_740_991);
        expect(valueToJS(valueFromJS(Type.UINT64, 12_345_678))).toBe(12_345_678);
    });

    it("round-trips floats and doubles within tolerance", () => {
        expect(valueToJS(valueFromJS(Type.FLOAT, 1.5)) as number).toBeCloseTo(1.5, 3);
        expect(valueToJS(valueFromJS(Type.DOUBLE, Math.PI)) as number).toBeCloseTo(Math.PI);
    });

    it("round-trips a non-empty string", () => {
        expect(valueToJS(valueFromJS(Type.STRING, "hello"))).toBe("hello");
    });

    it("round-trips an empty string", () => {
        expect(valueToJS(valueFromJS(Type.STRING, ""))).toBe("");
    });

    it("preserves null strings as null (not empty string)", () => {
        expect(valueToJS(valueFromJS(Type.STRING, null))).toBeNull();
    });
});

describe("valueFromJS / valueToJS round-trips — collections and references", () => {
    it("round-trips a string array via GStrv", () => {
        const strvGType = typeFromName("GStrv");
        expect(valueToJS(valueFromJS(strvGType, ["alpha", "beta", "gamma"]))).toEqual(["alpha", "beta", "gamma"]);
    });

    it("round-trips an empty string array via GStrv", () => {
        const strvGType = typeFromName("GStrv");
        expect(valueToJS(valueFromJS(strvGType, []))).toEqual([]);
    });

    it("round-trips a null GStrv as an empty array", () => {
        const strvGType = typeFromName("GStrv");
        expect(valueToJS(valueFromJS(strvGType, null))).toEqual([]);
    });

    it("round-trips an enum value preserving the integer payload", () => {
        const alignGType = callGetType("libgtk-4.so.1", "gtk_align_get_type");
        expect(valueToJS(valueFromJS(alignGType, Gtk.Align.CENTER))).toBe(Gtk.Align.CENTER);
    });

    it("round-trips a flags value preserving the bitmask", () => {
        const flagsGType = callGetType("libgobject-2.0.so.0", "g_binding_flags_get_type");
        expect(valueToJS(valueFromJS(flagsGType, 3))).toBe(3);
    });

    it("round-trips a boxed value resolving the registered wrapper class", () => {
        const rgbaGType = gdkRgbaGType();
        const result = valueToJS(valueFromJS(rgbaGType, makeRgba(0.5, 0.25, 0.75, 1.0)));
        expect(result).toBeInstanceOf(Gdk.RGBA);
        expect((result as Gdk.RGBA).red).toBeCloseTo(0.5);
        expect((result as Gdk.RGBA).green).toBeCloseTo(0.25);
        expect((result as Gdk.RGBA).blue).toBeCloseTo(0.75);
        expect((result as Gdk.RGBA).alpha).toBeCloseTo(1.0);
    });

    it("round-trips a GObject reference returning the same wrapper", () => {
        const label = new Gtk.Label({ label: "hello" });
        expect(valueToJS(valueFromJS(Type.OBJECT, label))).toBe(label);
    });

    it("round-trips a null GObject reference", () => {
        expect(valueToJS(valueFromJS(Type.OBJECT, null))).toBeNull();
    });

    it("accepts null for G_TYPE_POINTER and round-trips as null", () => {
        expect(valueToJS(valueFromJS(Type.POINTER, null))).toBeNull();
    });

    it("throws when valueFromJS is called with a non-null G_TYPE_POINTER value", () => {
        expect(() => valueFromJS(Type.POINTER, 42)).toThrow(/G_TYPE_POINTER/);
    });
});

describe("valueToJS extra coverage", () => {
    it("returns null when reading a default-initialized G_TYPE_POINTER", () => {
        const v = new Value();
        v.init(Type.POINTER);
        expect(valueToJS(v)).toBeNull();
    });

    it("returns an empty array when reading an unset GStrv value", () => {
        const v = new Value();
        v.init(typeFromName("GStrv"));
        expect(valueToJS(v)).toEqual([]);
    });

    it("returns a Gdk.RGBA wrapper when reading a boxed value", () => {
        const v = new Value();
        v.init(gdkRgbaGType());
        v.setBoxed(makeRgba(0.1, 0.2, 0.3, 1.0));
        expect(valueToJS(v)).toBeInstanceOf(Gdk.RGBA);
    });
});

describe("valueFromJS / valueToJS round-trips — variant and param", () => {
    it("round-trips a GLib.Variant preserving its payload", () => {
        const variant = GLib.Variant.newString("payload");
        const result = valueToJS(valueFromJS(Type.VARIANT, variant));
        expect(result).toBeInstanceOf(GLib.Variant);
        const [text] = (result as GLib.Variant).getString();
        expect(text).toBe("payload");
    });

    it("round-trips a ParamSpec to an equivalent wrapper", () => {
        const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
        const roundTripped = valueToJS(valueFromJS(Type.PARAM, spec)) as typeof spec | null;
        expect(roundTripped).not.toBeNull();
        expect(roundTripped?.getName()).toBe(spec.getName());
    });
});

describe("valueFromFfi — primitives", () => {
    it("builds a boolean value", () => {
        expect(valueFromFfi({ type: "boolean" }, true).getBoolean()).toBe(true);
    });

    it("builds a string value", () => {
        expect(valueFromFfi({ type: "string", ownership: "borrowed" }, "hi").getString()).toBe("hi");
    });

    it("builds an int value for int8/int16/int32 descriptors", () => {
        expect(valueFromFfi({ type: "int8" }, -1).getInt()).toBe(-1);
        expect(valueFromFfi({ type: "int16" }, 100).getInt()).toBe(100);
        expect(valueFromFfi({ type: "int32" }, 2000).getInt()).toBe(2000);
    });

    it("builds a uint value for uint8/uint16/uint32 descriptors", () => {
        expect(valueFromFfi({ type: "uint8" }, 1).getUint()).toBe(1);
        expect(valueFromFfi({ type: "uint16" }, 200).getUint()).toBe(200);
        expect(valueFromFfi({ type: "uint32" }, 4000).getUint()).toBe(4000);
    });

    it("builds int64 and uint64 values", () => {
        expect(valueFromFfi({ type: "int64" }, 42).getInt64()).toBe(42);
        expect(valueFromFfi({ type: "uint64" }, 84).getUint64()).toBe(84);
    });

    it("builds float and double values", () => {
        expect(valueFromFfi({ type: "float32" }, 1.5).getFloat()).toBeCloseTo(1.5, 3);
        expect(valueFromFfi({ type: "float64" }, Math.PI).getDouble()).toBeCloseTo(Math.PI);
    });
});

describe("valueFromFfi — enums and flags", () => {
    it("builds an enum value from library/getTypeFn descriptor", () => {
        const v = valueFromFfi(
            { type: "enum", library: "libgtk-4.so.1", getTypeFn: "gtk_align_get_type", signed: false },
            Gtk.Align.CENTER,
        );
        expect(v.getEnum()).toBe(Gtk.Align.CENTER);
    });

    it("builds a flags value from a flags-fundamental enum descriptor", () => {
        const v = valueFromFfi(
            { type: "enum", library: "libgobject-2.0.so.0", getTypeFn: "g_binding_flags_get_type", signed: false },
            3,
        );
        expect(v.getFlags()).toBe(3);
    });

    it("builds a flags value from a flags descriptor", () => {
        const v = valueFromFfi(
            { type: "flags", library: "libgobject-2.0.so.0", getTypeFn: "g_binding_flags_get_type", signed: false },
            5,
        );
        expect(v.getFlags()).toBe(5);
    });
});

describe("valueFromFfi — objects and boxed", () => {
    it("builds a gobject value", () => {
        const label = new Gtk.Label({ label: "x" });
        expect(valueFromFfi({ type: "gobject", ownership: "borrowed" }, label).getObject()).not.toBeNull();
    });

    it("builds a boxed value via getTypeFn resolution", () => {
        const v = valueFromFfi(
            {
                type: "boxed",
                ownership: "borrowed",
                innerType: "GdkRGBA",
                library: "libgtk-4.so.1",
                getTypeFn: "gdk_rgba_get_type",
            },
            makeRgba(0, 0, 0, 1),
        );
        expect(valueGetType(v)).toBe(gdkRgbaGType());
    });

    it("builds a boxed value when only innerType is provided", () => {
        const v = valueFromFfi({ type: "boxed", ownership: "borrowed", innerType: "GdkRGBA" }, makeRgba(0, 0, 0, 1));
        expect(valueGetType(v)).toBe(gdkRgbaGType());
    });

    it("throws for boxed types with an unresolvable innerType", () => {
        expect(() =>
            valueFromFfi({ type: "boxed", ownership: "borrowed", innerType: "NotARealGType" }, makeRgba(0, 0, 0, 1)),
        ).toThrow(/Cannot resolve gtype/);
    });
});

describe("valueFromFfi — variant fundamental", () => {
    it("round-trips a GVariant through a fundamental descriptor keyed by typeName", () => {
        const variant = GLib.Variant.newString("payload");
        const descriptor = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
            ownership: "borrowed",
            typeName: "GVariant",
        });

        const value = valueFromFfi(descriptor, variant);
        expect(valueGetType(value)).toBe(Type.VARIANT);

        const result = valueToJS(value);
        expect(result).toBeInstanceOf(GLib.Variant);
        expect((result as GLib.Variant).getString()[0]).toBe("payload");
    });
});

describe("valueFromFfi — arrays and errors", () => {
    it("builds a strv array value", () => {
        const v = valueFromFfi(
            {
                type: "array",
                kind: "array",
                ownership: "borrowed",
                itemType: { type: "string", ownership: "borrowed" },
            },
            ["one", "two"],
        );
        expect(valueToJS(v)).toEqual(["one", "two"]);
    });

    it("throws for unsupported array types", () => {
        expect(() =>
            valueFromFfi(
                {
                    type: "array",
                    kind: "glist",
                    ownership: "borrowed",
                    itemType: { type: "string", ownership: "borrowed" },
                },
                ["x"],
            ),
        ).toThrow(/Unsupported array type/);
    });

    it("throws for fundamental types without a typeName", () => {
        expect(() =>
            valueFromFfi(
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
        expect(() => valueFromFfi({ type: "unichar" }, 0)).toThrow(/Unsupported FFI type for GValue conversion/);
    });
});

describe("valueFromJS extra coverage", () => {
    it("returns a null-initialized BOXED value when value is null", () => {
        expect(valueGetType(valueFromJS(gdkRgbaGType(), null))).toBe(gdkRgbaGType());
    });

    it("returns a null-initialized BOXED value when value is undefined", () => {
        expect(valueGetType(valueFromJS(gdkRgbaGType(), undefined))).toBe(gdkRgbaGType());
    });

    it("returns an empty GStrv value when value is null", () => {
        expect(valueToJS(valueFromJS(typeFromName("GStrv"), null))).toEqual([]);
    });

    it("round-trips a signed char (G_TYPE_CHAR) through valueToJS", () => {
        expect(valueToJS(valueFromJS(typeFromName("gchar"), -1))).toBe(-1);
    });

    it("round-trips an unsigned char (G_TYPE_UCHAR) through valueToJS", () => {
        expect(valueToJS(valueFromJS(typeFromName("guchar"), 200))).toBe(200);
    });
});
