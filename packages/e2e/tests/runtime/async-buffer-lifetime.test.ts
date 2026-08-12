import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { getHandle, promisify, t } from "@gtkx/runtime";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

type WriteToStream = (stream: Gio.FileOutputStream) => Promise<unknown>;
type WriteToPath = (path: string) => Promise<unknown>;

const PAYLOAD_LENGTH = 512;
const ROUNDS = 8;
const REUSE_ATTEMPTS = 8;
const payload = Array.from({ length: PAYLOAD_LENGTH }, (_, index) => (index % 255) + 1);
const sentinel = Array.from({ length: PAYLOAD_LENGTH }, () => 0);
const directory = mkdtempSync(join(tmpdir(), "gtkx-async-buffer-"));

const replaceContentsAsync = t.fn("libgio-2.0.so.0", "g_file_replace_contents_async", {
    args: [
        { type: t.object("borrowed") },
        { type: t.sizedArray(t.uint8, 2, "borrowed") },
        { type: t.uint64 },
        { type: t.string("borrowed") },
        { type: t.boolean },
        { type: t.flags("libgio-2.0.so.0", "g_file_create_flags_get_type", false) },
        { type: t.object("borrowed") },
        {
            type: t.callback([t.object("borrowed"), t.object("borrowed"), t.uint64], t.void, {
                hasUserData: true,
                userDataIndex: 2,
                scope: "async",
            }),
        },
    ],
    returns: t.void,
});

const claimFreedStashes = (): void => {
    for (let attempt = 0; attempt < REUSE_ATTEMPTS; attempt += 1) {
        GLib.base64Encode(sentinel);
    }
};

const readBack = (path: string): number[] => [...readFileSync(path)];

const replaceContents = async (path: string): Promise<void> => {
    const written = Gio.File.newForPath(path).replaceContentsAsync(
        payload,
        null,
        false,
        Gio.FileCreateFlags.NONE,
        null,
    );

    claimFreedStashes();
    await written;
};

const writeThroughStream = async (path: string, write: WriteToStream): Promise<void> => {
    const stream = Gio.File.newForPath(path).replace(null, false, Gio.FileCreateFlags.NONE, null);
    const written = write(stream);
    claimFreedStashes();
    await written;
    stream.close(null);
};

const replaceContentsFromOverwrittenView = async (path: string): Promise<void> => {
    const file = Gio.File.newForPath(path);
    const view = Uint8Array.from(payload);

    const written = promisify(
        replaceContentsAsync,
        (result: Gio.AsyncResult) => file.replaceContentsFinish(result),
        null,
        getHandle(file),
        view,
        view.byteLength,
        null,
        false,
        Gio.FileCreateFlags.NONE,
    );

    view.fill(0);
    claimFreedStashes();
    await written;
};

const expectWrittenBytesToSurvive = async (name: string, write: WriteToPath): Promise<void> => {
    for (let round = 0; round < ROUNDS; round += 1) {
        const path = join(directory, `${name}-${String(round)}.dat`);
        await write(path);
        expect(readBack(path)).toEqual(payload);
    }
};

describe("async calls taking a borrowed array", () => {
    afterAll(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    it("writes the given bytes through replaceContentsAsync", () =>
        expectWrittenBytesToSurvive("replace-contents", replaceContents));

    it("writes the given bytes through writeAsync", () =>
        expectWrittenBytesToSurvive("write", (path) =>
            writeThroughStream(path, (stream) => stream.writeAsync(payload, 0, null))));

    it("writes the given bytes through writeAllAsync", () =>
        expectWrittenBytesToSurvive("write-all", (path) =>
            writeThroughStream(path, (stream) => stream.writeAllAsync(payload, 0, null))));

    it("writes the bytes a typed array held when the call was made", () =>
        expectWrittenBytesToSurvive("view", replaceContentsFromOverwrittenView));
});
