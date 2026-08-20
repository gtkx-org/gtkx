import * as GLib from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

const ucs4ToUtf8FromCodepoints = GLib.ucs4ToUtf8 as (str: (string | number)[]) => [string, bigint, bigint];

describe("unichar arrays", () => {
    it("round-trips UCS-4 text through utf8ToUcs4 and ucs4ToUtf8, including astral codepoints", () => {
        const [ucs4, itemsRead, itemsWritten] = GLib.utf8ToUcs4("a💩b", -1n);
        expect(ucs4).toEqual(["a", "💩", "b"]);
        expect(itemsRead).toBe(6n);
        expect(itemsWritten).toBe(3n);
        const [utf8] = GLib.ucs4ToUtf8(ucs4);
        expect(utf8).toBe("a💩b");
        const [fast] = GLib.utf8ToUcs4Fast("héllo", -1n);
        expect(fast).toEqual(["h", "é", "l", "l", "o"]);
        const [fromUtf16] = GLib.utf16ToUcs4([0x61, 0xD8_3D, 0xDC_A9]);
        expect(fromUtf16).toEqual(["a", "💩"]);
        const [fromCodepoints] = ucs4ToUtf8FromCodepoints([0x61, 0x01_F4_A9, 0x62]);
        expect(fromCodepoints).toBe("a💩b");
    });

    it("handles empty input and stops at an embedded NUL", () => {
        const [emptyUtf8] = GLib.ucs4ToUtf8([]);
        expect(emptyUtf8).toBe("");
        const [emptyUcs4] = GLib.utf8ToUcs4("", -1n);
        expect(emptyUcs4).toEqual([]);
        const [truncated] = GLib.ucs4ToUtf8(["A", "\0", "B"]);
        expect(truncated).toBe("A");
    });

    it("throws on invalid codepoints and invalid elements", () => {
        expect(() => ucs4ToUtf8FromCodepoints([0xD8_00])).toThrow();
        expect(() => ucs4ToUtf8FromCodepoints([0x11_00_00])).toThrow();
        expect(() => ucs4ToUtf8FromCodepoints([1.5])).toThrow();
        expect(() => GLib.ucs4ToUtf8(["ab"])).toThrow();
    });
});
