import {
    type GType,
    TYPE_BOOLEAN,
    TYPE_CHAR,
    TYPE_DOUBLE,
    TYPE_FLOAT,
    TYPE_INT,
    TYPE_INT64,
    TYPE_LONG,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_STRING,
    TYPE_UCHAR,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_ULONG,
    TYPE_VARIANT,
} from "@gtkx/ffi";
import * as GLib from "@gtkx/gi/glib";
import { ParamFlags, paramSpecBoolean } from "@gtkx/gi/gobject";
import { call, type Handle } from "@gtkx/native";
import {
    newGValue,
    valueGetBoolean,
    valueGetDouble,
    valueGetEnum,
    valueGetFlags,
    valueGetFloat,
    valueGetInt,
    valueGetInt64,
    valueGetLong,
    valueGetObject,
    valueGetParam,
    valueGetSchar,
    valueGetString,
    valueGetUchar,
    valueGetUint,
    valueGetUint64,
    valueGetUlong,
    valueGetVariant,
    valueInit,
    valueSetBoolean,
    valueSetDouble,
    valueSetEnum,
    valueSetFlags,
    valueSetFloat,
    valueSetInt,
    valueSetInt64,
    valueSetLong,
    valueSetObject,
    valueSetParam,
    valueSetSchar,
    valueSetString,
    valueSetUchar,
    valueSetUint,
    valueSetUint64,
    valueSetUlong,
    valueSetVariant,
} from "../../src/gvalue.js";
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

const enumGtype = (): GType => gtypeOf("libgtk-4.so.1", "gtk_align_get_type");
const flagsGtype = (): GType => gtypeOf("libgobject-2.0.so.0", "g_binding_flags_get_type");

const initialized = (gtype: GType): Handle => {
    const value = newGValue();
    valueInit(value, gtype);
    return value;
};

describe("GValue boolean", () => {
    it("round-trips true and false", () => {
        const value = initialized(TYPE_BOOLEAN);
        valueSetBoolean(value, true);
        expect(valueGetBoolean(value)).toBe(true);
        valueSetBoolean(value, false);
        expect(valueGetBoolean(value)).toBe(false);
    });
});

describe("GValue signed and unsigned integers", () => {
    it("round-trips an int", () => {
        const value = initialized(TYPE_INT);
        valueSetInt(value, -42);
        expect(valueGetInt(value)).toBe(-42);
    });

    it("round-trips a uint", () => {
        const value = initialized(TYPE_UINT);
        valueSetUint(value, 4_000_000_000);
        expect(valueGetUint(value)).toBe(4_000_000_000);
    });

    it("round-trips a long", () => {
        const value = initialized(TYPE_LONG);
        valueSetLong(value, 123_456);
        expect(valueGetLong(value)).toBe(123_456);
    });

    it("round-trips a ulong", () => {
        const value = initialized(TYPE_ULONG);
        valueSetUlong(value, 654_321);
        expect(valueGetUlong(value)).toBe(654_321);
    });

    it("round-trips an int64", () => {
        const value = initialized(TYPE_INT64);
        valueSetInt64(value, -9_007_199_254_740_991);
        expect(valueGetInt64(value)).toBe(-9_007_199_254_740_991);
    });

    it("round-trips a uint64", () => {
        const value = initialized(TYPE_UINT64);
        valueSetUint64(value, 9_007_199_254_740_991);
        expect(valueGetUint64(value)).toBe(9_007_199_254_740_991);
    });

    it("round-trips a schar", () => {
        const value = initialized(TYPE_CHAR);
        valueSetSchar(value, -12);
        expect(valueGetSchar(value)).toBe(-12);
    });

    it("round-trips a uchar", () => {
        const value = initialized(TYPE_UCHAR);
        valueSetUchar(value, 200);
        expect(valueGetUchar(value)).toBe(200);
    });
});

describe("GValue floating point", () => {
    it("round-trips a float within tolerance", () => {
        const value = initialized(TYPE_FLOAT);
        valueSetFloat(value, 1.5);
        expect(valueGetFloat(value)).toBeCloseTo(1.5, 3);
    });

    it("round-trips a double", () => {
        const value = initialized(TYPE_DOUBLE);
        valueSetDouble(value, Math.PI);
        expect(valueGetDouble(value)).toBeCloseTo(Math.PI);
    });
});

describe("GValue string", () => {
    it("round-trips a non-empty string", () => {
        const value = initialized(TYPE_STRING);
        valueSetString(value, "hello");
        expect(valueGetString(value)).toBe("hello");
    });

    it("round-trips an empty string", () => {
        const value = initialized(TYPE_STRING);
        valueSetString(value, "");
        expect(valueGetString(value)).toBe("");
    });

    it("round-trips a null string as null", () => {
        const value = initialized(TYPE_STRING);
        valueSetString(value, null);
        expect(valueGetString(value)).toBeNull();
    });
});

describe("GValue enum and flags", () => {
    it("round-trips an enum payload", () => {
        const value = initialized(enumGtype());
        valueSetEnum(value, Gtk.Align.CENTER);
        expect(valueGetEnum(value)).toBe(Gtk.Align.CENTER);
    });

    it("round-trips a flags bitmask", () => {
        const value = initialized(flagsGtype());
        valueSetFlags(value, 3);
        expect(valueGetFlags(value)).toBe(3);
    });
});

describe("GValue object", () => {
    it("round-trips a live GObject returning the same wrapper", () => {
        const label = new Gtk.Label({ label: "hello" });
        const value = initialized(TYPE_OBJECT);
        valueSetObject(value, label);
        expect(valueGetObject(value)).toBe(label);
    });

    it("round-trips a null object", () => {
        const value = initialized(TYPE_OBJECT);
        valueSetObject(value, null);
        expect(valueGetObject(value)).toBeNull();
    });
});

describe("GValue param", () => {
    it("round-trips a ParamSpec to an equivalent wrapper", () => {
        const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
        const value = initialized(TYPE_PARAM);
        valueSetParam(value, spec);
        const roundTripped = valueGetParam(value) as typeof spec | null;
        expect(roundTripped).not.toBeNull();
        expect(roundTripped?.getName()).toBe(spec.getName());
    });

    it("round-trips a null param", () => {
        const value = initialized(TYPE_PARAM);
        valueSetParam(value, null);
        expect(valueGetParam(value)).toBeNull();
    });
});

describe("GValue variant", () => {
    it("round-trips a GLib.Variant preserving its payload", () => {
        const variant = GLib.Variant.newString("payload");
        const value = initialized(TYPE_VARIANT);
        valueSetVariant(value, variant);

        const extracted = valueGetVariant(value);
        expect(extracted).toBeInstanceOf(GLib.Variant);
        const [text] = (extracted as GLib.Variant).getString();
        expect(text).toBe("payload");
    });

    it("returns null for an unset variant", () => {
        const value = initialized(TYPE_VARIANT);
        valueSetVariant(value, null);
        expect(valueGetVariant(value)).toBeNull();
    });
});
