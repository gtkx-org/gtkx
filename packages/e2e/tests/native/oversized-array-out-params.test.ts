import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MAX_JS_ARRAY_LENGTH = 134_217_728;

describe("marshalling - array out-parameters beyond the JavaScript array limit", () => {
    let directory = "";
    let oversizedPath = "";

    const pathForSize = (size: number) => {
        const path = join(directory, `contents-${String(size)}.bin`);
        writeFileSync(path, "");
        truncateSync(path, size);

        return path;
    };

    beforeAll(() => {
        directory = mkdtempSync(join(tmpdir(), "gtkx-oversized-array-"));
        oversizedPath = pathForSize(MAX_JS_ARRAY_LENGTH + 1);
    });

    afterAll(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    it("throws a catchable error instead of aborting the process", () => {
        expect(() => GLib.fileGetContents(oversizedPath)).toThrow(/134217729 elements/);
    });

    it("rejects a promisified call instead of aborting the process", async () => {
        const file = Gio.File.newForPath(oversizedPath);
        await expect(file.loadContentsAsync(null)).rejects.toThrow(/134217729 elements/);
    });

    it("still decodes an array below the limit", () => {
        expect(GLib.fileGetContents(pathForSize(8))).toEqual([true, [0, 0, 0, 0, 0, 0, 0, 0]]);
    });
});
