import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";

test("bound libc calls preserve strings across repeated calls", () => {
    const duplicate = t.bind("libc.so.6", "strdup", [t.string()], t.string("full"));

    expect(duplicate("café")).toBe("café");
    expect(duplicate("")).toBe("");
    expect(() => duplicate("a\0b")).toThrow();
    expect(duplicate("recovered")).toBe("recovered");
});

test("function signatures pack out parameters into the returned tuple", () => {
    const split = t.fn("libm.so.6", "modf", {
        args: [{ type: t.float64 }, { type: t.float64, direction: "out" }],
        returns: t.float64,
    });

    expect(split(12.75)).toEqual([0.75, 12]);
    expect(split(-3.5)).toEqual([-0.5, -3]);
});

test("bound references update caller storage and reject invalid seeds", () => {
    const split = t.bind("libm.so.6", "modf", [t.float64, t.ref(t.float64)], t.float64);
    const integer: { value: unknown } = { value: null };

    expect(split(12.75, integer)).toBe(0.75);
    expect(integer.value).toBe(12);
    integer.value = "invalid";
    expect(() => split(1, integer)).toThrow();
    expect(integer.value).toBe("invalid");
});

test("native function resolution is lazy and reports absent symbols", () => {
    const absent = t.fn("libc.so.6", "gtkx_missing_symbol", { args: [], returns: t.void });
    const absentLibrary = t.fn("libgtkx-missing.so", "nothing", { args: [], returns: t.void });

    expect(() => absent()).toThrow();
    expect(() => absentLibrary()).toThrow();
});
