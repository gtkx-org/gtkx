import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const GLIB = "libglib-2.0.so.0";
const STRUP_ARGS = [{ type: t.string() }, { type: t.int64 }];
const strupFromObject = t.fn(GLIB, "g_ascii_strup", { args: STRUP_ARGS, returns: t.string("full") });
const strupFromThunk = t.fn(GLIB, "g_ascii_strup", () => ({ args: STRUP_ARGS, returns: t.string("full") }));

describe("a native binding", () => {
    it("calls through when its signature is given as an object", () => {
        expect(strupFromObject("abc", -1)).toBe("ABC");
    });

    it("calls through when its signature is given as a function", () => {
        expect(strupFromThunk("abc", -1)).toBe("ABC");
    });

    it("keeps calling through once it has been used", () => {
        const results = Array.from({ length: 8 }, () => strupFromThunk("abc", -1));
        expect(results).toEqual(Array.from({ length: 8 }, () => "ABC"));
    });

    it("describes a symbol the library does not export without looking it up", () => {
        expect(() => t.fn(GLIB, "g_absent_symbol", () => ({ args: [], returns: t.void }))).not.toThrow();
    });

    it("describes a binding into a library that cannot be loaded without loading it", () => {
        expect(() => t.fn("libabsent-0.so.0", "g_ascii_strup", () => ({ args: [], returns: t.void }))).not.toThrow();
    });

    it("throws when a call needs a symbol the library does not export", () => {
        const absent = t.fn(GLIB, "g_absent_symbol", () => ({ args: [], returns: t.void }));
        expect(() => absent()).toThrow();
    });

    it("throws when a call needs a library that cannot be loaded", () => {
        const absent = t.fn("libabsent-0.so.0", "g_ascii_strup", () => ({ args: [], returns: t.void }));
        expect(() => absent()).toThrow();
    });
});
