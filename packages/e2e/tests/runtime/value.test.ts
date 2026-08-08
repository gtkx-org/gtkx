import type { Type } from "@gtkx/gi/gobject";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { ParamFlags, paramSpecBoolean, typeFromName, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
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
} from "@gtkx/runtime";
import { getHandle, t } from "@gtkx/runtime";
import "@gtkx/gi/gobject";
import {
    fromValue,
    getBoxedValue,
    getValueType,
    inoutValueForBoxedDescriptor,
    newValueForDescriptor,
    outValueForBoxedDescriptor,
    resolveType,
    toValue,
} from "@gtkx/runtime/internal";
import { describe, expect, it } from "vitest";

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

const alignDescriptor = {
    kind: "enum",
    sharedLibrary: "libgtk-4.so.1",
    getTypeFnName: "gtk_align_get_type",
    isSigned: false,
} as const;

const bindingFlagsDescriptor = {
    kind: "flags",
    sharedLibrary: "libgobject-2.0.so.0",
    getTypeFnName: "g_binding_flags_get_type",
    isSigned: false,
} as const;

const paramDescriptor = t.fundamental("libgobject-2.0.so.0", "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});

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

const gtypeOfEmpty = (ffi: Parameters<typeof newValueForDescriptor>[0]): Type =>
    getValueType(newValueForDescriptor(ffi));

describe("generated GObject.Value boxed accessors", () => {
    it("round-trips a boxed instance through setBoxed and getBoxed", () => {
        const value = new Value();
        value.init(gdkRgbaGtype());
        value.setBoxed(makeRgba(0.5, 0.25, 0.75, 1));
        const extracted = value.getBoxed<Gdk.RGBA>();
        expect(extracted).toBeInstanceOf(Gdk.RGBA);
        expect(extracted.red).toBeCloseTo(0.5);
        expect(extracted.green).toBeCloseTo(0.25);
        expect(extracted.blue).toBeCloseTo(0.75);
        expect(extracted.alpha).toBeCloseTo(1);
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
        v.setBoxed(makeRgba(0.1, 0.2, 0.3, 1));
        expect(fromValue(getHandle(v))).toBeInstanceOf(Gdk.RGBA);
    });

    it("returns the object a value typed as an interface holds", () => {
        const store = new Gio.ListStore({ itemType: TYPE_OBJECT });
        const v = new Value();
        v.init(typeFromName("GListModel"));
        v.setObject(store);
        expect(fromValue(getHandle(v))).toBe(store);
    });

    it("returns null for a value typed as an interface holding nothing", () => {
        const v = new Value();
        v.init(typeFromName("GListModel"));
        expect(fromValue(getHandle(v))).toBeNull();
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
            { kind: "enum", sharedLibrary: "libgtk-4.so.1", getTypeFnName: "gtk_align_get_type", isSigned: false },
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
                isSigned: false,
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
                isSigned: false,
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
            isSigned: false,
        } as const;

        const flags = {
            kind: "flags",
            sharedLibrary: "libgobject-2.0.so.0",
            getTypeFnName: "g_binding_flags_get_type",
            isSigned: false,
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

describe("fromValue / toValue round-trips (1)", () => {
    describe("GValue boolean", () => {
        it("round-trips true and false", () => {
            expect(fromValue(toValue({ kind: "boolean" }, true))).toBe(true);
            expect(fromValue(toValue({ kind: "boolean" }, false))).toBe(false);
        });
    });

    describe("GValue signed and unsigned integers", () => {
        it("round-trips an int", () => {
            expect(fromValue(toValue({ kind: "int32" }, -42))).toBe(-42);
        });

        it("round-trips a uint", () => {
            expect(fromValue(toValue({ kind: "uint32" }, 4_000_000_000))).toBe(4_000_000_000);
        });

        it("round-trips an int64 beyond the safe-integer range", () => {
            expect(fromValue(toValue({ kind: "bigint64" }, -9_223_372_036_854_775_808n))).toBe(
                -9_223_372_036_854_775_808n,
            );
        });

        it("round-trips a uint64 beyond the safe-integer range", () => {
            expect(fromValue(toValue({ kind: "biguint64" }, 18_446_744_073_709_551_615n))).toBe(
                18_446_744_073_709_551_615n,
            );
        });
    });

    describe("GValue floating point", () => {
        it("round-trips a float within tolerance", () => {
            expect(fromValue(toValue({ kind: "float32" }, 1.5))).toBeCloseTo(1.5, 3);
        });

        it("round-trips a double", () => {
            expect(fromValue(toValue({ kind: "float64" }, Math.PI))).toBeCloseTo(Math.PI);
        });
    });

    describe("GValue string", () => {
        it("round-trips a non-empty string", () => {
            expect(fromValue(toValue({ kind: "string", ownership: "borrowed" }, "hello"))).toBe("hello");
        });

        it("round-trips an empty string", () => {
            expect(fromValue(toValue({ kind: "string", ownership: "borrowed" }, ""))).toBe("");
        });

        it("round-trips a null string as null", () => {
            expect(fromValue(toValue({ kind: "string", ownership: "borrowed" }, null))).toBeNull();
        });
    });
});

describe("fromValue / toValue round-trips (2)", () => {
    describe("GValue enum and flags", () => {
        it("round-trips an enum payload", () => {
            expect(fromValue(toValue(alignDescriptor, Gtk.Align.CENTER))).toBe(Gtk.Align.CENTER);
        });

        it("round-trips a flags bitmask", () => {
            expect(fromValue(toValue(bindingFlagsDescriptor, 3))).toBe(3);
        });
    });

    describe("GValue object", () => {
        it("round-trips a live GObject returning the same wrapper", () => {
            const label = new Gtk.Label({ label: "hello" });
            expect(fromValue(toValue({ kind: "object", ownership: "borrowed" }, label))).toBe(label);
        });

        it("round-trips a null object", () => {
            expect(fromValue(toValue({ kind: "object", ownership: "borrowed" }, null))).toBeNull();
        });
    });

    describe("GValue param", () => {
        it("round-trips a ParamSpec to an equivalent wrapper", () => {
            const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
            const roundTripped = fromValue(toValue(paramDescriptor, spec)) as typeof spec | null;
            expect(roundTripped).not.toBeNull();
            expect(roundTripped?.getName()).toBe(spec.getName());
        });

        it("round-trips a null param", () => {
            expect(fromValue(toValue(paramDescriptor, null))).toBeNull();
        });
    });

    describe("GValue variant", () => {
        it("round-trips a GLib.Variant preserving its payload", () => {
            const variant = GLib.Variant.newString("payload");
            const extracted = fromValue(toValue(variantFfi, variant));
            expect(extracted).toBeInstanceOf(GLib.Variant);
            const [text] = (extracted as GLib.Variant).getString();
            expect(text).toBe("payload");
        });

        it("returns null for an unset variant", () => {
            expect(fromValue(toValue(variantFfi, null))).toBeNull();
        });
    });
});

describe("getBoxedValue / out & inout boxed descriptors", () => {
    const rectangleFfi = t.boxed("GdkRectangle", {
        ownership: "borrowed",
        sharedLibrary: "libgtk-4.so.1",
        getTypeFnName: "gdk_rectangle_get_type",
    });

    it("inoutValueForBoxedDescriptor shares the caller's wrapper so an in-place mutation is visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = inoutValueForBoxedDescriptor(rectangleFfi, rect);
        rect.width = 42;
        const seen = getBoxedValue(value) as Gdk.Rectangle;
        expect(seen.width).toBe(42);
    });

    it("outValueForBoxedDescriptor copies the wrapper so a later mutation is not visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = outValueForBoxedDescriptor(rectangleFfi, rect);
        rect.width = 42;
        const seen = getBoxedValue(value) as Gdk.Rectangle;
        expect(seen.width).toBe(1);
    });
});
