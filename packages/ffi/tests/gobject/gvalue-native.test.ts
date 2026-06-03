import { type GType, GValue, Type } from "@gtkx/ffi";
import * as GLib from "@gtkx/gi/glib";
import { ParamFlags, paramSpecBoolean } from "@gtkx/gi/gobject";
import { call } from "@gtkx/native";
import "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const gtypeOf = (library: string, getTypeFn: string): GType => {
    const result = call(library, getTypeFn, [], { type: "uint64" });
    if (typeof result !== "number") {
        throw new TypeError(`${getTypeFn} did not return a GType`);
    }
    return result;
};

const enumGType = (): GType => gtypeOf("libgtk-4.so.1", "gtk_align_get_type");
const flagsGType = (): GType => gtypeOf("libgobject-2.0.so.0", "g_binding_flags_get_type");

const initialized = (gType: GType): GValue => {
    const value = new GValue();
    value.init(gType);
    return value;
};

describe("GValue boolean", () => {
    it("round-trips true and false", () => {
        const value = initialized(Type.BOOLEAN);
        value.setBoolean(true);
        expect(value.getBoolean()).toBe(true);
        value.setBoolean(false);
        expect(value.getBoolean()).toBe(false);
    });
});

describe("GValue signed and unsigned integers", () => {
    it("round-trips an int", () => {
        const value = initialized(Type.INT);
        value.setInt(-42);
        expect(value.getInt()).toBe(-42);
    });

    it("round-trips a uint", () => {
        const value = initialized(Type.UINT);
        value.setUint(4_000_000_000);
        expect(value.getUint()).toBe(4_000_000_000);
    });

    it("round-trips a long", () => {
        const value = initialized(Type.LONG);
        value.setLong(123_456);
        expect(value.getLong()).toBe(123_456);
    });

    it("round-trips a ulong", () => {
        const value = initialized(Type.ULONG);
        value.setUlong(654_321);
        expect(value.getUlong()).toBe(654_321);
    });

    it("round-trips an int64", () => {
        const value = initialized(Type.INT64);
        value.setInt64(-9_007_199_254_740_991);
        expect(value.getInt64()).toBe(-9_007_199_254_740_991);
    });

    it("round-trips a uint64", () => {
        const value = initialized(Type.UINT64);
        value.setUint64(9_007_199_254_740_991);
        expect(value.getUint64()).toBe(9_007_199_254_740_991);
    });

    it("round-trips a schar", () => {
        const value = initialized(Type.CHAR);
        value.setSchar(-12);
        expect(value.getSchar()).toBe(-12);
    });

    it("round-trips a uchar", () => {
        const value = initialized(Type.UCHAR);
        value.setUchar(200);
        expect(value.getUchar()).toBe(200);
    });
});

describe("GValue floating point", () => {
    it("round-trips a float within tolerance", () => {
        const value = initialized(Type.FLOAT);
        value.setFloat(1.5);
        expect(value.getFloat()).toBeCloseTo(1.5, 3);
    });

    it("round-trips a double", () => {
        const value = initialized(Type.DOUBLE);
        value.setDouble(Math.PI);
        expect(value.getDouble()).toBeCloseTo(Math.PI);
    });
});

describe("GValue string", () => {
    it("round-trips a non-empty string", () => {
        const value = initialized(Type.STRING);
        value.setString("hello");
        expect(value.getString()).toBe("hello");
    });

    it("round-trips an empty string", () => {
        const value = initialized(Type.STRING);
        value.setString("");
        expect(value.getString()).toBe("");
    });

    it("round-trips a null string as null", () => {
        const value = initialized(Type.STRING);
        value.setString(null);
        expect(value.getString()).toBeNull();
    });
});

describe("GValue enum and flags", () => {
    it("round-trips an enum payload", () => {
        const value = initialized(enumGType());
        value.setEnum(Gtk.Align.CENTER);
        expect(value.getEnum()).toBe(Gtk.Align.CENTER);
    });

    it("round-trips a flags bitmask", () => {
        const value = initialized(flagsGType());
        value.setFlags(3);
        expect(value.getFlags()).toBe(3);
    });
});

describe("GValue object", () => {
    it("round-trips a live GObject returning the same wrapper", () => {
        const label = new Gtk.Label({ label: "hello" });
        const value = initialized(Type.OBJECT);
        value.setObject(label);
        expect(value.getObject()).toBe(label);
    });

    it("round-trips a null object", () => {
        const value = initialized(Type.OBJECT);
        value.setObject(null);
        expect(value.getObject()).toBeNull();
    });
});

describe("GValue param", () => {
    it("round-trips a ParamSpec to an equivalent wrapper", () => {
        const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
        const value = initialized(Type.PARAM);
        value.setParam(spec);
        const roundTripped = value.getParam() as typeof spec | null;
        expect(roundTripped).not.toBeNull();
        expect(roundTripped?.getName()).toBe(spec.getName());
    });

    it("round-trips a null param", () => {
        const value = initialized(Type.PARAM);
        value.setParam(null);
        expect(value.getParam()).toBeNull();
    });
});

describe("GValue variant", () => {
    it("round-trips a GLib.Variant preserving its payload", () => {
        const variant = GLib.Variant.newString("payload");
        const value = initialized(Type.VARIANT);
        value.setVariant(variant);

        const extracted = value.getVariant();
        expect(extracted).toBeInstanceOf(GLib.Variant);
        const [text] = (extracted as GLib.Variant).getString();
        expect(text).toBe("payload");
    });

    it("returns null for an unset variant", () => {
        const value = initialized(Type.VARIANT);
        value.setVariant(null);
        expect(value.getVariant()).toBeNull();
    });
});
