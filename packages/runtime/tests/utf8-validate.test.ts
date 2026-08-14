import * as GLib from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

describe("GLib.utf8Validate", () => {
    it("reports an empty remainder for empty text", () => {
        expect(GLib.utf8Validate(new Uint8Array())).toEqual([true, new Uint8Array()]);
    });

    it("reports an empty remainder for fully valid text", () => {
        expect(GLib.utf8Validate(new Uint8Array([0x61, 0x62, 0x63]))).toEqual([true, new Uint8Array()]);
    });

    it("reports the same remainder on every call", () => {
        const results = Array.from({ length: 64 }, () => GLib.utf8Validate([0x61]));
        const areAllEmpty = results.every((result) => result[1].length === 0);
        expect(areAllEmpty).toBe(true);
    });

    it("reports the bytes from the first invalid character", () => {
        expect(GLib.utf8Validate(new Uint8Array([0x61, 0xFF, 0x62]))).toEqual([false, new Uint8Array([0xFF, 0x62])]);
    });
});

describe("GLib.utf8ValidateLen", () => {
    it("reports an empty remainder for empty text", () => {
        expect(GLib.utf8ValidateLen(new Uint8Array())).toEqual([true, new Uint8Array()]);
    });

    it("reports the bytes from the first invalid character", () => {
        expect(GLib.utf8ValidateLen(new Uint8Array([0x61, 0xFF, 0x62]))).toEqual([false, new Uint8Array([0xFF, 0x62])]);
    });
});
