import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const directories: string[] = [];

function directoryWithOneFile(size: number) {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-measure-"));
    directories.push(directory);
    writeFileSync(join(directory, "payload.bin"), Buffer.alloc(size, 7));

    return directory;
}

afterAll(() => {
    for (const directory of directories) {
        rmSync(directory, { force: true, recursive: true });
    }
});

describe("64-bit out and inout parameters", () => {
    it("reads a gint64 out parameter back from g_ascii_string_to_signed", () => {
        expect(GLib.asciiStringToSigned("42", 10, -100n, 100n)).toEqual([true, 42n]);
    });

    it("reads the smallest gint64 out value without truncation", () => {
        expect(GLib.asciiStringToSigned("-9223372036854775808", 10, -9_223_372_036_854_775_808n, 0n)).toEqual([
            true,
            -9_223_372_036_854_775_808n,
        ]);
    });

    it("reads the largest guint64 out value without truncation", () => {
        expect(GLib.asciiStringToUnsigned("18446744073709551615", 10, 0n, 18_446_744_073_709_551_615n)).toEqual([
            true,
            18_446_744_073_709_551_615n,
        ]);
    });

    it("writes back a gint64 inout parameter through g_time_zone_adjust_time", () => {
        const [, adjusted] = GLib.TimeZone.newUtc().adjustTime(GLib.TimeType.STANDARD, 1_700_000_000n);
        expect(adjusted).toBe(1_700_000_000n);
    });

    it("reads two gint64 out parameters from a single call", () => {
        expect(GLib.utf16ToUtf8([104, 105])).toEqual(["hi", 2n, 2n]);
    });

    it("reads three guint64 out parameters from g_file_measure_disk_usage", () => {
        const directory = directoryWithOneFile(4096);

        const [measured, diskUsage, directoryCount, fileCount] = Gio.File.newForPath(directory).measureDiskUsage(
            Gio.FileMeasureFlags.APPARENT_SIZE,
            null,
            null,
        );

        expect(measured).toBe(true);
        expect(diskUsage).toBeGreaterThanOrEqual(4096n);
        expect(directoryCount).toBe(1n);
        expect(fileCount).toBe(1n);
    });
});
