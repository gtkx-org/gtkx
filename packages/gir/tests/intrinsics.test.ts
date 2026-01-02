import { describe, expect, it } from "vitest";
import {
    INTRINSIC_TYPES,
    isIntrinsicType,
    isNumericType,
    isStringType,
    isVoidType,
    NUMERIC_TYPES,
    STRING_TYPES,
    VOID_TYPES,
} from "../src/intrinsics.js";

describe("isIntrinsicType", () => {
    describe("void types", () => {
        it.each(["void", "none"])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("boolean types", () => {
        it("returns true for gboolean", () => {
            expect(isIntrinsicType("gboolean")).toBe(true);
        });
    });

    describe("signed integer types", () => {
        it.each([
            "gint",
            "gint8",
            "gint16",
            "gint32",
            "gint64",
            "gchar",
            "gshort",
            "glong",
            "gssize",
            "goffset",
            "gintptr",
        ])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("unsigned integer types", () => {
        it.each([
            "guint",
            "guint8",
            "guint16",
            "guint32",
            "guint64",
            "guchar",
            "gushort",
            "gulong",
            "gsize",
            "guintptr",
        ])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("float types", () => {
        it.each(["gfloat", "gdouble"])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("pointer types", () => {
        it.each(["gpointer", "gconstpointer"])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("string types", () => {
        it.each(["utf8", "filename"])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("GType system types", () => {
        it.each(["GType", "GParamSpec", "GVariant"])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("C types", () => {
        it.each([
            "int",
            "uint",
            "long",
            "ulong",
            "float",
            "double",
            "size_t",
            "ssize_t",
        ])("returns true for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(true);
        });
    });

    describe("non-intrinsic types", () => {
        it.each(["GtkWidget", "GObject", "Gio.File", "MyCustomType", "Widget", ""])("returns false for %s", (type) => {
            expect(isIntrinsicType(type)).toBe(false);
        });
    });
});

describe("isStringType", () => {
    it("returns true for utf8", () => {
        expect(isStringType("utf8")).toBe(true);
    });

    it("returns true for filename", () => {
        expect(isStringType("filename")).toBe(true);
    });

    it("returns false for non-string types", () => {
        expect(isStringType("gint")).toBe(false);
        expect(isStringType("gpointer")).toBe(false);
        expect(isStringType("GtkWidget")).toBe(false);
    });
});

describe("isNumericType", () => {
    describe("integer types", () => {
        it.each([
            "gint",
            "guint",
            "gint8",
            "guint8",
            "gint16",
            "guint16",
            "gint32",
            "guint32",
            "gint64",
            "guint64",
            "gchar",
            "guchar",
            "gshort",
            "gushort",
            "glong",
            "gulong",
            "gsize",
            "gssize",
            "goffset",
            "gintptr",
            "guintptr",
        ])("returns true for %s", (type) => {
            expect(isNumericType(type)).toBe(true);
        });
    });

    describe("float types", () => {
        it.each(["gfloat", "gdouble", "float", "double"])("returns true for %s", (type) => {
            expect(isNumericType(type)).toBe(true);
        });
    });

    describe("C types", () => {
        it.each(["int", "uint", "long", "ulong", "size_t", "ssize_t"])("returns true for %s", (type) => {
            expect(isNumericType(type)).toBe(true);
        });
    });

    it("returns true for GType (treated as numeric)", () => {
        expect(isNumericType("GType")).toBe(true);
    });

    it("returns false for non-numeric types", () => {
        expect(isNumericType("utf8")).toBe(false);
        expect(isNumericType("gboolean")).toBe(false);
        expect(isNumericType("gpointer")).toBe(false);
        expect(isNumericType("GtkWidget")).toBe(false);
    });
});

describe("isVoidType", () => {
    it("returns true for void", () => {
        expect(isVoidType("void")).toBe(true);
    });

    it("returns true for none", () => {
        expect(isVoidType("none")).toBe(true);
    });

    it("returns false for non-void types", () => {
        expect(isVoidType("gint")).toBe(false);
        expect(isVoidType("utf8")).toBe(false);
        expect(isVoidType("gboolean")).toBe(false);
        expect(isVoidType("GtkWidget")).toBe(false);
    });
});

describe("type sets consistency", () => {
    it("STRING_TYPES is subset of INTRINSIC_TYPES", () => {
        for (const type of STRING_TYPES) {
            expect(INTRINSIC_TYPES.has(type)).toBe(true);
        }
    });

    it("VOID_TYPES is subset of INTRINSIC_TYPES", () => {
        for (const type of VOID_TYPES) {
            expect(INTRINSIC_TYPES.has(type)).toBe(true);
        }
    });

    it("most NUMERIC_TYPES are subset of INTRINSIC_TYPES", () => {
        for (const type of NUMERIC_TYPES) {
            expect(INTRINSIC_TYPES.has(type)).toBe(true);
        }
    });
});
