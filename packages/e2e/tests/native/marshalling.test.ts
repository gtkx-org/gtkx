import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/runtime";
import { mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MAX_JS_ARRAY_LENGTH = 134_217_728;
const ASCII_LOWERCASE_A = 97;
const ASCII_UPPERCASE_A = 65;
const oversized = { directory: "", path: "" };

const pathForSize = (size: number): string => {
    const path = join(oversized.directory, `contents-${String(size)}.bin`);
    writeFileSync(path, "");
    truncateSync(path, size);

    return path;
};

beforeAll(() => {
    oversized.directory = mkdtempSync(join(tmpdir(), "gtkx-oversized-array-"));
    oversized.path = pathForSize(MAX_JS_ARRAY_LENGTH + 1);
});

afterAll(() => {
    rmSync(oversized.directory, { force: true, recursive: true });
});

describe("marshalling across the napi boundary (1)", () => {
    it("round-trips 32-bit and 64-bit floats", () => {
        const label = Gtk.Label.new("Test");
        label.setXalign(0.25);
        label.setOpacity(0.123456789);
        expect(label.getXalign()).toBeCloseTo(0.25);
        expect(label.getOpacity()).toBeCloseTo(0.123456789);
    });

    it("round-trips every integer width through GVariant and through plain arguments", () => {
        expect(GLib.Variant.newByte(200).getByte()).toBe(200);
        expect(GLib.Variant.newInt16(-12_345).getInt16()).toBe(-12_345);
        expect(GLib.Variant.newUint16(54_321).getUint16()).toBe(54_321);
        expect(GLib.Variant.newInt32(-2_000_000_000).getInt32()).toBe(-2_000_000_000);
        expect(GLib.Variant.newUint32(4_000_000_000).getUint32()).toBe(4_000_000_000);
        expect(GLib.Variant.newInt64(-9_000_000_000_000_000_000n).getInt64()).toBe(-9_000_000_000_000_000_000n);
        expect(GLib.Variant.newUint64(18_000_000_000_000_000_000n).getUint64()).toBe(18_000_000_000_000_000_000n);
        expect(GLib.asciiToupper(ASCII_LOWERCASE_A)).toBe(ASCII_UPPERCASE_A);
        expect(GLib.asciiStrup("abc", -1)).toBe("ABC");
    });

    it("round-trips string arrays, including empty ones and unicode", () => {
        const label = Gtk.Label.new("Test");
        label.setCssClasses(["alpha", "beta", "gamma"]);
        expect(label.getCssClasses()).toEqual(["alpha", "beta", "gamma"]);
        label.setCssClasses(["café", "naïve", "日本語"]);
        expect(label.getCssClasses()).toEqual(["café", "naïve", "日本語"]);
        label.setCssClasses([]);
        expect(label.getCssClasses()).toEqual([]);
    });

    it("passes null to optional string and object arguments", () => {
        expect(Gtk.Label.new(null).getText()).toBe("");
        const button = Gtk.Button.new();
        button.setChild(Gtk.Label.new("Child"));
        expect(button.getChild()).not.toBeNull();
        button.setChild(null);
        expect(button.getChild()).toBeNull();
    });
});

describe("marshalling across the napi boundary (2)", () => {
    it("populates integer out-params and unsigned properties", () => {
        const label = Gtk.Label.new("Test");
        label.setSizeRequest(120, 40);
        expect(label.getSizeRequest()).toEqual([120, 40]);
        const grid = Gtk.Grid.new();
        grid.setRowSpacing(7);
        expect(grid.getRowSpacing()).toBe(7);
    });

    it("decodes an array out-param below the JavaScript array limit", () => {
        expect(GLib.fileGetContents(pathForSize(8))).toEqual([true, new Uint8Array(8)]);
    });

    it("throws instead of aborting for an array out-param beyond that limit, synchronously or not", async () => {
        expect(() => GLib.fileGetContents(oversized.path)).toThrow();
        await expect(Gio.File.newForPath(oversized.path).loadContentsAsync(null)).rejects.toThrow();
    });

    it("hands back byte arrays as typed arrays, whichever form they were passed in", () => {
        const encoded = GLib.base64Encode(new Uint8Array([104, 105]));
        expect(GLib.base64Decode(encoded)).toEqual(new Uint8Array([104, 105]));
        expect(GLib.ByteArray.append(new Uint8Array([1, 2]), new Uint8Array([3]))).toEqual(new Uint8Array([1, 2, 3]));
        expect(GLib.ByteArray.append([1, 2], [3])).toEqual(new Uint8Array([1, 2, 3]));
        expect(GLib.fileGetContents(pathForSize(0))).toEqual([true, new Uint8Array()]);
    });

    it("throws when a byte array descriptor is declared over a wider element", () => {
        expect(() =>
            t.fn("libglib-2.0.so.0", "g_utf8_validate", {
                args: [{ type: t.sizedArray(t.int16, 1, "borrowed", { isBytes: true }) }, { type: t.int64 }],
                returns: t.boolean,
            }),
        ).toThrow();
    });

    it("throws when a byte array argument is given a view of the wrong element type", () => {
        // @ts-expect-error an Int16Array is not one of the byte-array input types
        expect(() => GLib.ByteArray.append(new Int16Array([1, 2]), new Uint8Array([3]))).toThrow();
        // @ts-expect-error a DataView is not one of the byte-array input types
        expect(() => GLib.ByteArray.append(new DataView(new ArrayBuffer(2)), new Uint8Array([3]))).toThrow();
    });
});
