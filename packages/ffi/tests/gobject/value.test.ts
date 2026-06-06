import { Type } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import type { GType } from "@gtkx/gi/gobject";
import { ParamFlags, paramSpecBoolean, typeFromName, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";
import { t, valueFromFfi, valueFromObject, valueGetType, valueToJS } from "@gtkx/ffi";
import { call } from "@gtkx/native";
import { emptyValueFromFfi } from "../../src/gobject/gvalue.js";

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
        expect(valueGetType(valueFromFfi({ type: "string", ownership: "borrowed" }, "test"))).toBe(Type.STRING);
    });

    it("returns the GType of a boolean value", () => {
        expect(valueGetType(valueFromFfi({ type: "boolean" }, true))).toBe(Type.BOOLEAN);
    });

    it("returns the GType of an int value", () => {
        expect(valueGetType(valueFromFfi({ type: "int32" }, 42))).toBe(Type.INT);
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

describe("valueFromFfi — variant and param fundamentals", () => {
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

    it("marshals a GParamSpec through the PARAM fundamental, not the boxed path", () => {
        const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
        const descriptor = t.fundamental("libgobject-2.0.so.0", "g_param_spec_ref", "g_param_spec_unref", {
            ownership: "borrowed",
            typeName: "GParam",
        });

        const value = valueFromFfi(descriptor, spec);
        expect(valueGetType(value)).toBe(Type.PARAM);

        const result = valueToJS(value) as typeof spec | null;
        expect(result?.getName()).toBe(spec.getName());
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

const gtypeOfEmpty = (ffi: Parameters<typeof emptyValueFromFfi>[0]): GType => valueGetType(emptyValueFromFfi(ffi));
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

describe("emptyValueFromFfi — GType resolution from an FFI descriptor", () => {
    it("resolves primitive descriptors to their fundamental GType", () => {
        expect(gtypeOfEmpty({ type: "boolean" })).toBe(Type.BOOLEAN);
        expect(gtypeOfEmpty({ type: "string", ownership: "borrowed" })).toBe(Type.STRING);
        expect(gtypeOfEmpty({ type: "int8" })).toBe(Type.INT);
        expect(gtypeOfEmpty({ type: "int16" })).toBe(Type.INT);
        expect(gtypeOfEmpty({ type: "int32" })).toBe(Type.INT);
        expect(gtypeOfEmpty({ type: "uint8" })).toBe(Type.UINT);
        expect(gtypeOfEmpty({ type: "uint16" })).toBe(Type.UINT);
        expect(gtypeOfEmpty({ type: "uint32" })).toBe(Type.UINT);
        expect(gtypeOfEmpty({ type: "int64" })).toBe(Type.INT64);
        expect(gtypeOfEmpty({ type: "uint64" })).toBe(Type.UINT64);
        expect(gtypeOfEmpty({ type: "float32" })).toBe(Type.FLOAT);
        expect(gtypeOfEmpty({ type: "float64" })).toBe(Type.DOUBLE);
        expect(gtypeOfEmpty({ type: "gobject", ownership: "borrowed" })).toBe(Type.OBJECT);
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
        expect(gtypeOfEmpty(gdkRgbaFfi)).toBe(gdkRgbaGType());
        expect(gtypeOfEmpty(variantFfi)).toBe(Type.VARIANT);
    });

    it("resolves a string-array descriptor to GStrv", () => {
        expect(gtypeOfEmpty(strvFfi)).toBe(typeFromName("GStrv"));
    });

    it("throws for unsupported descriptors", () => {
        expect(() => emptyValueFromFfi({ ...strvFfi, kind: "glist" })).toThrow(/unsupported array type/);
        expect(() => emptyValueFromFfi({ type: "unichar" })).toThrow(/unsupported FFI type/);
    });
});
