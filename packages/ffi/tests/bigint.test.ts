import { t } from "@gtkx/ffi";
import { alloc, read, write } from "@gtkx/native";
import { describe, expect, it } from "vitest";

const GLIB = "libglib-2.0.so.0";

const formatSize = t.fn(GLIB, "g_format_size", [{ type: t.biguint64 }], t.string("full"));

const asciiStrtoull = t.fn(
    GLIB,
    "g_ascii_strtoull",
    [{ type: t.string("borrowed") }, { type: t.uint64 }, { type: t.uint32 }],
    t.biguint64,
);

const BEYOND_2_53 = 9_007_199_254_740_993n;

describe("bigint call descriptors", () => {
    it("returns a guint64 call result as an exact bigint", () => {
        expect(asciiStrtoull("18446744073709551615", 0, 10)).toBe(18_446_744_073_709_551_615n);
    });

    it("passes a bigint argument through a guint64 parameter", () => {
        expect(formatSize(BEYOND_2_53)).toContain("PB");
    });

    it("accepts plain integral numbers for bigint slots", () => {
        expect(asciiStrtoull("42", 0, 10)).toBe(42n);
        expect(formatSize(1000)).toContain("kB");
    });

    it("rejects a fractional number for a bigint slot", () => {
        expect(() => formatSize(1.5)).toThrow(/pass a bigint/);
    });

    it("rejects a negative bigint for an unsigned slot", () => {
        expect(() => formatSize(-1n)).toThrow(/out of range for biguint64/);
    });
});

describe("bigint memory access", () => {
    it("round-trips a value beyond 2^53 through native memory", () => {
        const storage = alloc(8);
        write(storage, t.biguint64, 0, BEYOND_2_53);
        expect(read(storage, t.biguint64, 0)).toBe(BEYOND_2_53);
    });

    it("round-trips a negative value through a signed bigint slot", () => {
        const storage = alloc(8);
        write(storage, t.bigint64, 0, -BEYOND_2_53);
        expect(read(storage, t.bigint64, 0)).toBe(-BEYOND_2_53);
    });
});

describe("number-typed 64-bit loss guard", () => {
    it("errors instead of rounding when a 64-bit read exceeds 2^53", () => {
        const storage = alloc(8);
        write(storage, t.biguint64, 0, BEYOND_2_53);
        expect(() => read(storage, t.uint64, 0)).toThrow(/2\^53/);
    });

    it("reads 64-bit values below 2^53 as plain numbers unchanged", () => {
        const storage = alloc(8);
        write(storage, t.uint64, 0, 1234);
        expect(read(storage, t.uint64, 0)).toBe(1234);
    });
});
