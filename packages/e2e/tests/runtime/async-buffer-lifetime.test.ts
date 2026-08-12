import * as Gio from "@gtkx/gi/gio";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

type WriteToStream = (stream: Gio.FileOutputStream) => Promise<unknown>;

const payload = [1, 2, 3, 4, 5, 6, 7, 8];
const directory = mkdtempSync(join(tmpdir(), "gtkx-async-buffer-"));

const churnHeap = (): void => {
    for (let index = 0; index < 4096; index += 1) {
        Gio.File.newForPath(join(directory, `churn-${String(index)}`)).getPath();
    }
};

const readBack = (path: string): number[] => {
    const [, contents] = Gio.File.newForPath(path).loadContents(null);

    return contents;
};

const writeThroughStream = async (path: string, write: WriteToStream): Promise<void> => {
    const stream = Gio.File.newForPath(path).replace(null, false, Gio.FileCreateFlags.NONE, null);
    const written = write(stream);
    churnHeap();
    await written;
    stream.close(null);
};

describe("async calls taking a borrowed array", () => {
    afterAll(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    it("writes the given bytes through replaceContentsAsync", async () => {
        const path = join(directory, "replace-contents.dat");

        const written = Gio.File.newForPath(path).replaceContentsAsync(
            payload,
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null,
        );

        churnHeap();
        await written;
        expect(readBack(path)).toEqual(payload);
    });

    it("writes the given bytes through writeAsync", async () => {
        const path = join(directory, "write.dat");
        await writeThroughStream(path, (stream) => stream.writeAsync(payload, 0, null));
        expect(readBack(path)).toEqual(payload);
    });

    it("writes the given bytes through writeAllAsync", async () => {
        const path = join(directory, "write-all.dat");
        await writeThroughStream(path, (stream) => stream.writeAllAsync(payload, 0, null));
        expect(readBack(path)).toEqual(payload);
    });
});
