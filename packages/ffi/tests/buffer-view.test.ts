import { t } from "@gtkx/ffi";
import { describe, expect, it } from "vitest";

const GLIB = "libglib-2.0.so.0";
const G_CHECKSUM_MD5 = 0;
const ABC_MD5 = "900150983cd24fb0d6963f7d28e17f72";
const E_ACUTE = 0xe9;
const E_ACUTE_UTF8 = [0xc3, 0xa9];

const computeChecksumForData = t.bind(
    GLIB,
    "g_compute_checksum_for_data",
    [t.int32, t.array(t.uint8), t.uint64],
    t.string("full"),
);

const unicharToUtf8 = t.bind(GLIB, "g_unichar_to_utf8", [t.uint32, t.buffer], t.int32);

describe("ArrayBufferView array arguments", () => {
    it("passes a typed array's bytes to the callee zero-copy", () => {
        expect(computeChecksumForData(G_CHECKSUM_MD5, new Uint8Array([97, 98, 99]), 3)).toBe(ABC_MD5);
    });

    it("honors a view's byte offset", () => {
        const data = new Uint8Array([120, 97, 98, 99]).subarray(1);
        expect(computeChecksumForData(G_CHECKSUM_MD5, data, 3)).toBe(ABC_MD5);
    });

    it("still accepts plain number arrays", () => {
        expect(computeChecksumForData(G_CHECKSUM_MD5, [97, 98, 99], 3)).toBe(ABC_MD5);
    });

    it("rejects a view whose element kind does not match the array items", () => {
        expect(() => computeChecksumForData(G_CHECKSUM_MD5, new Float64Array(3), 3)).toThrow(/Float64Array/);
    });

    it("rejects SharedArrayBuffer-backed views", () => {
        const shared = new Uint8Array(new SharedArrayBuffer(4));
        expect(() => computeChecksumForData(G_CHECKSUM_MD5, shared, 4)).toThrow(/SharedArrayBuffer/);
    });
});

describe("buffer arguments", () => {
    it("lets the callee write into a typed array", () => {
        const out = new Uint8Array(6);
        expect(unicharToUtf8(E_ACUTE, out)).toBe(2);
        expect(Array.from(out.subarray(0, 2))).toEqual(E_ACUTE_UTF8);
    });

    it("lets the callee write through a DataView window", () => {
        const backing = new ArrayBuffer(8);
        const view = new DataView(backing, 2, 6);
        expect(unicharToUtf8(E_ACUTE, view)).toBe(2);
        expect(Array.from(new Uint8Array(backing, 2, 2))).toEqual(E_ACUTE_UTF8);
    });

    it("encodes null as NULL so the callee only reports the length", () => {
        expect(unicharToUtf8(E_ACUTE, null)).toBe(2);
    });

    it("rejects SharedArrayBuffer-backed views", () => {
        const shared = new Uint8Array(new SharedArrayBuffer(8));
        expect(() => unicharToUtf8(E_ACUTE, shared)).toThrow(/SharedArrayBuffer/);
    });
});
