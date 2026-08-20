import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const state = { directory: "" };

const pathFor = (name: string): string => join(state.directory, name);

const replaceBytes = (file: Gio.File, text: string): Promise<string | null> =>
    file.replaceContentsBytesAsync(
        GLib.Bytes.new(new TextEncoder().encode(text)),
        null,
        false,
        Gio.FileCreateFlags.NONE,
        null,
    );

beforeAll(() => {
    state.directory = mkdtempSync(join(tmpdir(), "gtkx-promisified-finish-"));
});

afterAll(() => {
    rmSync(state.directory, { force: true, recursive: true });
});

describe("promisified finish results", () => {
    it("promisifies replaceContentsBytesAsync through its irregular finish function", async () => {
        const path = pathFor("bytes.txt");
        const etag = await replaceBytes(Gio.File.newForPath(path), "written through GBytes");
        expect(typeof etag).toBe("string");
        expect(readFileSync(path, "utf8")).toBe("written through GBytes");
    });

    it("resolves loadContentsAsync to the out values without the leading boolean", async () => {
        const path = pathFor("contents.txt");
        writeFileSync(path, "trimmed payload");
        const result = await Gio.File.newForPath(path).loadContentsAsync(null);
        expect(result).toHaveLength(2);
        const [contents, etag] = result;
        expect(contents).toBeInstanceOf(Uint8Array);
        expect(new TextDecoder().decode(contents)).toBe("trimmed payload");
        expect(typeof etag).toBe("string");
    });

    it("resolves a pair left with a single out value to that value directly", async () => {
        const path = pathFor("single.txt");

        const etag = await Gio.File.newForPath(path).replaceContentsAsync(
            new TextEncoder().encode("single out"),
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null,
        );

        expect(typeof etag).toBe("string");
        expect(readFileSync(path, "utf8")).toBe("single out");
    });

    it("still promisifies a regular same-stem pair whose finish returns an object", async () => {
        const path = pathFor("regular.txt");
        writeFileSync(path, "regular pair");

        const info = await Gio.File.newForPath(path).queryInfoAsync(
            "standard::size",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
        );

        expect(info).toBeInstanceOf(Gio.FileInfo);
        expect(Number(info.getSize())).toBe("regular pair".length);
    });

    it("rejects when the operation fails", async () => {
        await expect(Gio.File.newForPath(pathFor("missing.txt")).loadContentsAsync(null)).rejects.toThrow();
    });

    it("rejects when the irregular pair fails", async () => {
        const file = Gio.File.newForPath(join(state.directory, "no-such-dir", "bytes.txt"));
        await expect(replaceBytes(file, "unwritable")).rejects.toThrow();
    });
});
