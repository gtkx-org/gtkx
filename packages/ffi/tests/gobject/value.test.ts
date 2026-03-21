import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";
import "../../src/gobject/value.js";
import { Value } from "../../src/generated/gobject/value.js";
import { Type } from "../../src/gobject/types.js";

describe("Value factory methods", () => {
    describe("newFromBoolean", () => {
        it("creates a GValue holding true", () => {
            const v = Value.newFromBoolean(true);
            expect(v.getBoolean()).toBe(true);
        });

        it("creates a GValue holding false", () => {
            const v = Value.newFromBoolean(false);
            expect(v.getBoolean()).toBe(false);
        });
    });

    describe("newFromInt", () => {
        it("creates a GValue holding a positive integer", () => {
            const v = Value.newFromInt(42);
            expect(v.getInt()).toBe(42);
        });

        it("creates a GValue holding a negative integer", () => {
            const v = Value.newFromInt(-7);
            expect(v.getInt()).toBe(-7);
        });

        it("creates a GValue holding zero", () => {
            const v = Value.newFromInt(0);
            expect(v.getInt()).toBe(0);
        });
    });

    describe("newFromUint", () => {
        it("creates a GValue holding an unsigned integer", () => {
            const v = Value.newFromUint(255);
            expect(v.getUint()).toBe(255);
        });
    });

    describe("newFromLong", () => {
        it("creates a GValue holding a long", () => {
            const v = Value.newFromLong(100000);
            expect(v.getLong()).toBe(100000);
        });
    });

    describe("newFromUlong", () => {
        it("creates a GValue holding an unsigned long", () => {
            const v = Value.newFromUlong(200000);
            expect(v.getUlong()).toBe(200000);
        });
    });

    describe("newFromInt64", () => {
        it("creates a GValue holding a 64-bit integer", () => {
            const v = Value.newFromInt64(9007199254740991);
            expect(v.getInt64()).toBe(9007199254740991);
        });
    });

    describe("newFromUint64", () => {
        it("creates a GValue holding an unsigned 64-bit integer", () => {
            const v = Value.newFromUint64(12345678);
            expect(v.getUint64()).toBe(12345678);
        });
    });

    describe("newFromFloat", () => {
        it("creates a GValue holding a float", () => {
            const v = Value.newFromFloat(3.14);
            expect(v.getFloat()).toBeCloseTo(3.14, 2);
        });
    });

    describe("newFromDouble", () => {
        it("creates a GValue holding a double", () => {
            const v = Value.newFromDouble(Math.PI);
            expect(v.getDouble()).toBeCloseTo(Math.PI);
        });
    });

    describe("newFromString", () => {
        it("creates a GValue holding a string", () => {
            const v = Value.newFromString("hello");
            expect(v.getString()).toBe("hello");
        });

        it("creates a GValue holding null", () => {
            const v = Value.newFromString(null);
            expect(v.getString()).toBeNull();
        });

        it("creates a GValue holding an empty string", () => {
            const v = Value.newFromString("");
            expect(v.getString()).toBe("");
        });
    });

    describe("newFromObject", () => {
        it("creates a GValue holding a GObject", () => {
            const label = new Gtk.Label("test");
            const v = Value.newFromObject(label);
            const retrieved = v.getObject();
            expect(retrieved).not.toBeNull();
        });

        it("creates a GValue holding null", () => {
            const v = Value.newFromObject(null);
            expect(v.getObject()).toBeNull();
        });
    });

    describe("newFromBoxed", () => {
        it("creates a GValue holding a boxed type", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
            const v = Value.newFromBoxed(rgba);
            expect(v).not.toBeNull();
        });
    });

    describe("newFromEnum", () => {
        it("creates a GValue holding an enum", () => {
            const gtype = Type.ENUM;
            const v = Value.newFromEnum(gtype, 0);
            expect(v.getEnum()).toBe(0);
        });
    });

    describe("newFromFlags", () => {
        it("creates a GValue holding flags", () => {
            const gtype = Type.FLAGS;
            const v = Value.newFromFlags(gtype, 3);
            expect(v.getFlags()).toBe(3);
        });
    });
});

describe("Value instance methods", () => {
    describe("getType", () => {
        it("returns the GType of a string value", () => {
            const v = Value.newFromString("test");
            expect(v.getType()).toBe(Type.STRING);
        });

        it("returns the GType of a boolean value", () => {
            const v = Value.newFromBoolean(true);
            expect(v.getType()).toBe(Type.BOOLEAN);
        });

        it("returns the GType of an int value", () => {
            const v = Value.newFromInt(42);
            expect(v.getType()).toBe(Type.INT);
        });
    });

    describe("getTypeName", () => {
        it("returns 'gchararray' for a string value", () => {
            const v = Value.newFromString("test");
            expect(v.getTypeName()).toBe("gchararray");
        });

        it("returns 'gboolean' for a boolean value", () => {
            const v = Value.newFromBoolean(false);
            expect(v.getTypeName()).toBe("gboolean");
        });

        it("returns 'gint' for an int value", () => {
            const v = Value.newFromInt(0);
            expect(v.getTypeName()).toBe("gint");
        });
    });

    describe("holds", () => {
        it("returns true when value holds the specified type", () => {
            const v = Value.newFromString("test");
            expect(v.holds(Type.STRING)).toBe(true);
        });

        it("returns false when value does not hold the specified type", () => {
            const v = Value.newFromString("test");
            expect(v.holds(Type.INT)).toBe(false);
        });
    });

    describe("getBoxed", () => {
        it("returns an owned copy of the boxed value", () => {
            const rgba = new Gdk.RGBA({ red: 0.5, green: 0.25, blue: 0.75, alpha: 1.0 });
            const v = Value.newFromBoxed(rgba);
            const extracted = v.getBoxed(Gdk.RGBA);
            expect(extracted).not.toBeNull();
            expect(extracted?.getRed()).toBeCloseTo(0.5);
            expect(extracted?.getGreen()).toBeCloseTo(0.25);
            expect(extracted?.getBlue()).toBeCloseTo(0.75);
            expect(extracted?.getAlpha()).toBeCloseTo(1.0);
        });
    });
});
