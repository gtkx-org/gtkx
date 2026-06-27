import * as GLib from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

describe("marshalling - integer types across the napi boundary", () => {
    it("round-trips uint8 through a byte GVariant", () => {
        const variant = GLib.Variant.newByte(200);

        expect(variant.getByte()).toBe(200);
    });

    it("round-trips signed int16 through a GVariant", () => {
        const variant = GLib.Variant.newInt16(-12345);

        expect(variant.getInt16()).toBe(-12345);
    });

    it("round-trips unsigned uint16 through a GVariant", () => {
        const variant = GLib.Variant.newUint16(54321);

        expect(variant.getUint16()).toBe(54321);
    });

    it("round-trips signed int32 through a GVariant", () => {
        const variant = GLib.Variant.newInt32(-2000000000);

        expect(variant.getInt32()).toBe(-2000000000);
    });

    it("round-trips unsigned uint32 through a GVariant", () => {
        const variant = GLib.Variant.newUint32(4000000000);

        expect(variant.getUint32()).toBe(4000000000);
    });

    it("round-trips signed int64 through a bigint GVariant", () => {
        const variant = GLib.Variant.newInt64(-9000000000000000000n);

        expect(variant.getInt64()).toBe(-9000000000000000000n);
    });

    it("round-trips unsigned uint64 through a bigint GVariant", () => {
        const variant = GLib.Variant.newUint64(18000000000000000000n);

        expect(variant.getUint64()).toBe(18000000000000000000n);
    });

    it("marshals a signed int8 argument and return through g_ascii_toupper", () => {
        const lowercaseA = 97;
        const uppercaseA = 65;

        expect(GLib.asciiToupper(lowercaseA)).toBe(uppercaseA);
    });

    it("marshals a numeric int64 length argument through g_ascii_strup", () => {
        expect(GLib.asciiStrup("abc", -1)).toBe("ABC");
    });
});
