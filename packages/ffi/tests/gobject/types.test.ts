import { Type } from "@gtkx/gi/gobject";
import { describe, expect, it } from "vitest";

const ZERO_VALUED_FUNDAMENTALS = ["INVALID", "NONE"] as const;

const NONZERO_FUNDAMENTALS = [
    "INTERFACE",
    "CHAR",
    "UCHAR",
    "BOOLEAN",
    "INT",
    "UINT",
    "LONG",
    "ULONG",
    "INT64",
    "UINT64",
    "ENUM",
    "FLAGS",
    "FLOAT",
    "DOUBLE",
    "STRING",
    "POINTER",
    "BOXED",
    "PARAM",
    "OBJECT",
    "VARIANT",
] as const;

describe("Type", () => {
    it.each(ZERO_VALUED_FUNDAMENTALS)("resolves %s to a GType value", (name) => {
        expect(typeof Type[name]).toBe("number");
    });

    it.each(NONZERO_FUNDAMENTALS)("resolves %s to a nonzero GType", (name) => {
        expect(Type[name]).toBeGreaterThan(0);
    });

    it("returns the same value on subsequent accesses", () => {
        const first = Type.STRING;
        const second = Type.STRING;
        expect(first).toBe(second);
    });

    it("returns distinct values for different types", () => {
        const types = new Set([
            Type.BOOLEAN,
            Type.INT,
            Type.UINT,
            Type.FLOAT,
            Type.DOUBLE,
            Type.STRING,
            Type.OBJECT,
            Type.BOXED,
        ]);
        expect(types.size).toBe(8);
    });
});
