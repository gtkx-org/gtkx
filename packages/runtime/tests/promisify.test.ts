import * as GdkPixbuf from "@gtkx/gi/gdkpixbuf";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, assert, describe, expect, it } from "vitest";

const directory = mkdtempSync(join(tmpdir(), "gtkx-promisify-"));

afterAll(() => {
    rmSync(directory, { force: true, recursive: true });
});

describe("generated promisified bindings", () => {
    it.each([
        { name: "content", contents: "hello" },
        { name: "empty", contents: "" },
    ])("returns the public load result for a $name file", async ({ name, contents }) => {
        const path = join(directory, name);
        writeFileSync(path, contents);
        const [bytes] = await Gio.File.newForPath(path).loadContentsAsync(null);

        expect(new TextDecoder().decode(bytes)).toBe(contents);
    });

    it("rejects when the native asynchronous operation fails", async () => {
        await expect(Gio.File.newForPath(join(directory, "missing")).loadContentsAsync(null)).rejects.toThrow();
    });

    it("resolves an instance async method against its annotated static finish", async () => {
        const pixbuf = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, false, 8, 2, 2);
        assert(pixbuf);
        const stream = Gio.MemoryOutputStream.newResizable();
        const isSaved = await pixbuf.saveToStreamvAsync(stream, "png", null, null);
        expect(isSaved).toBe(true);
        expect(stream.getDataSize()).toBeGreaterThan(0);
    });

    it("resolves an instance async method against a name-matched static finish", async () => {
        const firstOutput = Gio.MemoryOutputStream.newResizable();
        const secondOutput = Gio.MemoryOutputStream.newResizable();
        const firstInput = Gio.MemoryInputStream.newFromBytes(GLib.Bytes.new([1, 2, 3, 4]));
        const secondInput = Gio.MemoryInputStream.newFromBytes(GLib.Bytes.new([5, 6]));
        const first = Gio.SimpleIOStream.new(firstInput, firstOutput);
        const second = Gio.SimpleIOStream.new(secondInput, secondOutput);
        const isSpliced = await first.spliceAsync(second, Gio.IOStreamSpliceFlags.NONE, 0);
        expect(isSpliced).toBe(true);
        expect(secondOutput.getDataSize()).toBe(4);
        expect(firstOutput.getDataSize()).toBe(2);
    });
});
