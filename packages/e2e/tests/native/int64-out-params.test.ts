import * as GLib from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

describe("marshalling - 64-bit out-params", () => {
    it("reads a gint64 out-param through g_ascii_string_to_signed", () => {
        expect(GLib.asciiStringToSigned("42", 10, -100n, 100n)).toEqual([true, 42n]);
    });

    it("reads a negative gint64 out-param through g_ascii_string_to_signed", () => {
        expect(GLib.asciiStringToSigned("-9223372036854775808", 10, -9_223_372_036_854_775_808n, 0n)).toEqual([
            true,
            -9_223_372_036_854_775_808n,
        ]);
    });

    it("reads a guint64 out-param through g_ascii_string_to_unsigned", () => {
        expect(GLib.asciiStringToUnsigned("18446744073709551615", 10, 0n, 18_446_744_073_709_551_615n)).toEqual([
            true,
            18_446_744_073_709_551_615n,
        ]);
    });

    it("reads back a gint64 inout-param through g_time_zone_adjust_time", () => {
        const [, adjusted] = GLib.TimeZone.newUtc().adjustTime(GLib.TimeType.STANDARD, 1_700_000_000n);
        expect(adjusted).toBe(1_700_000_000n);
    });
});
