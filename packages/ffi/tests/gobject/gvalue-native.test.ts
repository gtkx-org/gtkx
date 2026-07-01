import { t } from "@gtkx/ffi";
import * as GLib from "@gtkx/gi/glib";
import { ParamFlags, paramSpecBoolean } from "@gtkx/gi/gobject";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { fromGValue, toGValue } from "../../src/gvalue.js";

const alignDescriptor = {
    kind: "enum",
    sharedLibrary: "libgtk-4.so.1",
    getTypeFnName: "gtk_align_get_type",
    signed: false,
} as const;

const bindingFlagsDescriptor = {
    kind: "flags",
    sharedLibrary: "libgobject-2.0.so.0",
    getTypeFnName: "g_binding_flags_get_type",
    signed: false,
} as const;

const paramDescriptor = t.fundamental("libgobject-2.0.so.0", "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});

const variantDescriptor = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});

describe("GValue boolean", () => {
    it("round-trips true and false", () => {
        expect(fromGValue(toGValue({ kind: "boolean" }, true))).toBe(true);
        expect(fromGValue(toGValue({ kind: "boolean" }, false))).toBe(false);
    });
});

describe("GValue signed and unsigned integers", () => {
    it("round-trips an int", () => {
        expect(fromGValue(toGValue({ kind: "int32" }, -42))).toBe(-42);
    });

    it("round-trips a uint", () => {
        expect(fromGValue(toGValue({ kind: "uint32" }, 4_000_000_000))).toBe(4_000_000_000);
    });

    it("round-trips an int64 beyond the safe-integer range", () => {
        expect(fromGValue(toGValue({ kind: "bigint64" }, -9_223_372_036_854_775_808n))).toBe(
            -9_223_372_036_854_775_808n,
        );
    });

    it("round-trips a uint64 beyond the safe-integer range", () => {
        expect(fromGValue(toGValue({ kind: "biguint64" }, 18_446_744_073_709_551_615n))).toBe(
            18_446_744_073_709_551_615n,
        );
    });
});

describe("GValue floating point", () => {
    it("round-trips a float within tolerance", () => {
        expect(fromGValue(toGValue({ kind: "float32" }, 1.5))).toBeCloseTo(1.5, 3);
    });

    it("round-trips a double", () => {
        expect(fromGValue(toGValue({ kind: "float64" }, Math.PI))).toBeCloseTo(Math.PI);
    });
});

describe("GValue string", () => {
    it("round-trips a non-empty string", () => {
        expect(fromGValue(toGValue({ kind: "string", ownership: "borrowed" }, "hello"))).toBe("hello");
    });

    it("round-trips an empty string", () => {
        expect(fromGValue(toGValue({ kind: "string", ownership: "borrowed" }, ""))).toBe("");
    });

    it("round-trips a null string as null", () => {
        expect(fromGValue(toGValue({ kind: "string", ownership: "borrowed" }, null))).toBeNull();
    });
});

describe("GValue enum and flags", () => {
    it("round-trips an enum payload", () => {
        expect(fromGValue(toGValue(alignDescriptor, Gtk.Align.CENTER))).toBe(Gtk.Align.CENTER);
    });

    it("round-trips a flags bitmask", () => {
        expect(fromGValue(toGValue(bindingFlagsDescriptor, 3))).toBe(3);
    });
});

describe("GValue object", () => {
    it("round-trips a live GObject returning the same wrapper", () => {
        const label = new Gtk.Label({ label: "hello" });
        expect(fromGValue(toGValue({ kind: "object", ownership: "borrowed" }, label))).toBe(label);
    });

    it("round-trips a null object", () => {
        expect(fromGValue(toGValue({ kind: "object", ownership: "borrowed" }, null))).toBeNull();
    });
});

describe("GValue param", () => {
    it("round-trips a ParamSpec to an equivalent wrapper", () => {
        const spec = paramSpecBoolean("flag", "Flag", "A flag", false, ParamFlags.READABLE);
        const roundTripped = fromGValue(toGValue(paramDescriptor, spec)) as typeof spec | null;
        expect(roundTripped).not.toBeNull();
        expect(roundTripped?.getName()).toBe(spec.getName());
    });

    it("round-trips a null param", () => {
        expect(fromGValue(toGValue(paramDescriptor, null))).toBeNull();
    });
});

describe("GValue variant", () => {
    it("round-trips a GLib.Variant preserving its payload", () => {
        const variant = GLib.Variant.newString("payload");
        const extracted = fromGValue(toGValue(variantDescriptor, variant));
        expect(extracted).toBeInstanceOf(GLib.Variant);
        const [text] = (extracted as GLib.Variant).getString();
        expect(text).toBe("payload");
    });

    it("returns null for an unset variant", () => {
        expect(fromGValue(toGValue(variantDescriptor, null))).toBeNull();
    });
});
