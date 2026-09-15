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

const splitFloat = t.bind("libm.so.6", "modf", [t.float64, t.ref(t.float64)], t.float64);

const parseOutputs = t.fn("libc.so.6", "sscanf", {
    args: [
        { type: string },
        { type: string },
        { type: t.ref(t.uint32) },
        { type: t.ref(t.string("full")) },
        { type: t.ref(t.unichar) },
    ],
    returns: t.int32,
    fixedArgCount: 2,
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

    it("reuses a scalar ref and rejects an invalid seed before calling C", () => {
        const integer: { value: unknown } = { value: null };

        expect(splitFloat(12.75, integer)).toBe(0.75);
        expect(integer.value).toBe(12);
        expect(splitFloat(-3.5, integer)).toBe(-0.5);
        expect(integer.value).toBe(-3);
        expect(() => splitFloat(1, "invalid")).toThrow();
        integer.value = "invalid";
        expect(() => splitFloat(1, integer)).toThrow();
        expect(integer.value).toBe("invalid");
    });

    it("omits optional scalar outputs without changing the primary result", () => {
        const timerType = t.struct("full", {
            sharedLibrary: "libglib-2.0.so.0",
            freeFnName: "g_timer_destroy",
        });
        const timer = t.bind("libglib-2.0.so.0", "g_timer_new", [], timerType)();
        t.bind("libglib-2.0.so.0", "g_timer_stop", [t.struct()], t.void)(timer);
        const elapsed = t.bind("libglib-2.0.so.0", "g_timer_elapsed", [t.struct(), t.ref(t.biguint64)], t.float64);
        const microseconds = { value: null };
        const seconds = elapsed(timer, microseconds);

        expect(elapsed(timer, null)).toBe(seconds);
        expect(elapsed(timer, undefined)).toBe(seconds);
        expect(typeof microseconds.value).toBe("bigint");
    });

    it("publishes mixed scalar and string outputs after every value decodes", () => {
        const count = { value: 1 };
        const text: { value: unknown } = { value: null };
        const character = { value: "Z" };

        expect(parseOutputs("7 gtkx 65", "%u %ms %u", count, text, character)).toBe(3);
        expect([count.value, text.value, character.value]).toEqual([7, "gtkx", "A"]);
    });

    it("keeps every ref unchanged when a later output cannot be decoded", () => {
        const count = { value: 1 };
        const text = { value: null };
        const character = { value: "Z" };

        expect(() => parseOutputs("7 gtkx 1114112", "%u %ms %u", count, text, character)).toThrow();
        expect([count.value, text.value, character.value]).toEqual([1, null, "Z"]);
        expect(parseOutputs("8 gtkx 66", "%u %ms %u", count, text, character)).toBe(3);
        expect([count.value, text.value, character.value]).toEqual([8, "gtkx", "B"]);
    });
});
