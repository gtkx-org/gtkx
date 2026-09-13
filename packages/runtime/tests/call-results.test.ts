import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const string = t.string("borrowed");
const parseInteger = t.bind(
    "libglib-2.0.so.0",
    "g_ascii_strtoll",
    [string, t.ref(string), t.uint32],
    t.bigint64,
);

const parseIntegerTuple = t.fn("libglib-2.0.so.0", "g_ascii_strtoll", {
    args: [{ type: string }, { type: string, direction: "out" }, { type: t.uint32 }],
    returns: t.bigint64,
});

describe("runtime native call results", () => {
    it("updates a bound ref while returning the native primary result", () => {
        const end: { value: unknown } = { value: null };

        expect(parseInteger("12abc", end, 10)).toBe(12n);
        expect(end.value).toBe("abc");
    });

    it("permits an omitted ref", () => {
        expect(parseInteger("12abc", null, 10)).toBe(12n);
    });

    it("packs an output into the callable's public tuple", () => {
        expect(parseIntegerTuple("12abc", 10)).toEqual([12n, "abc"]);
        expect(parseIntegerTuple("0", 10)).toEqual([0n, ""]);
    });

    it("rejects missing and extra bound arguments", () => {
        expect(() => parseInteger("12abc", null)).toThrow();
        expect(() => parseInteger("12abc", null, 10, 4)).toThrow();
    });

    it("rejects an invalid ref input", () => {
        expect(() => parseInteger("12abc", "invalid", 10)).toThrow();
    });
});
