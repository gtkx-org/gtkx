import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { getHandle, promisify, t } from "@gtkx/runtime";
import { closeSync, existsSync, mkdtempSync, readFileSync, readSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

type WriteToStream = (stream: Gio.FileOutputStream) => Promise<unknown>;
type WriteToPath = (path: string) => Promise<unknown>;

const PAYLOAD_LENGTH = 512;
const ROUNDS = 8;
const REUSE_ATTEMPTS = 8;
const MARKER = "gtkx-spawned-argument-vector";
const TRUE_ARGV = ["/bin/true"];
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

const printArgv = (text: string): string[] => ["/bin/sh", "-c", `printf %s "${text}"`];

const drainPipe = (fd: number): string => {
    const chunk = Buffer.alloc(256);
    let text = "";

    for (;;) {
        const read = readSync(fd, chunk, 0, chunk.length, null);

        if (read === 0) {
            break;
        }

        text += chunk.toString("utf8", 0, read);
    }

    closeSync(fd);

    return text;
};

const expectSpawnedChild = ([spawned, pid]: [boolean, GLib.Pid, ...number[]]): void => {
    expect(spawned).toBe(true);
    expect(pid).toBeGreaterThan(0);
};

const expectChildOutput = (
    spawn: [boolean, GLib.Pid, number, number, number],
    expected: string,
): void => {
    const [spawned, pid, stdinFd, stdoutFd, stderrFd] = spawn;
    expectSpawnedChild([spawned, pid]);
    closeSync(stdinFd);
    closeSync(stderrFd);
    expect(drainPipe(stdoutFd)).toBe(expected);
};

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

const replaceContentsWith = (file: Gio.File, callback: unknown): void => {
    replaceContentsAsync(
        getHandle(file),
        payload,
        payload.length,
        null,
        false,
        Gio.FileCreateFlags.NONE,
        null,
        callback,
    );
};

const replaceContentsFromOwnCallback = async (path: string): Promise<void> => {
    const file = Gio.File.newForPath(path);

    const written: Promise<void> = new Promise((resolve) => {
        replaceContentsWith(file, (_source: unknown, result: Gio.AsyncResult) => {
            file.replaceContentsFinish(result);
            resolve();
        });
    });

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

afterAll(() => {
    rmSync(directory, { force: true, recursive: true });
});

describe("async calls taking a borrowed array", () => {
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

    it("writes the given bytes for a completion callback the caller wrote itself", () =>
        expectWrittenBytesToSurvive("own-callback", replaceContentsFromOwnCallback));
});

describe("async calls made without a completion callback", () => {
    it("refuses a call that lends the callee memory, before the callee runs", () => {
        const path = join(directory, "no-callback.dat");

        expect(() => {
            replaceContentsWith(Gio.File.newForPath(path), null);
        }).toThrow();

        expect(existsSync(path)).toBe(false);
    });

    it("makes a call that lends the callee a borrowed string", async () => {
        const path = join(directory, "bytes-etag.dat");

        const written = Gio.File.newForPath(path).replaceContentsBytesAsync(
            GLib.Bytes.new(payload),
            "some-etag",
            false,
            Gio.FileCreateFlags.NONE,
            null,
        );

        await expect(written).resolves.toBeDefined();
        expect(existsSync(path)).toBe(true);
    });
});

describe("calls whose scope-async callback never reports a completion", () => {
    it("spawns a child through spawnAsync without a child setup", () => {
        expectSpawnedChild(
            GLib.spawnAsync(null, TRUE_ARGV, null, GLib.SpawnFlags.DEFAULT, null),
        );
    });

    it("spawns a child through spawnAsyncWithFds without a child setup", () => {
        expectSpawnedChild(
            GLib.spawnAsyncWithFds(
                null,
                TRUE_ARGV,
                null,
                GLib.SpawnFlags.DEFAULT,
                null,
                -1,
                -1,
                -1,
            ),
        );
    });

    it("hands the child the argument vector and environment spawnAsyncWithPipes was given", () => {
        expectChildOutput(
            GLib.spawnAsyncWithPipes(
                null,
                printArgv(`${MARKER}-$GTKX_SPAWN_MARKER`),
                [`GTKX_SPAWN_MARKER=${MARKER}`],
                GLib.SpawnFlags.DEFAULT,
                null,
            ),
            `${MARKER}-${MARKER}`,
        );
    });

    it("hands the child the argument vector spawnAsyncWithPipesAndFds was given", () => {
        expectChildOutput(
            GLib.spawnAsyncWithPipesAndFds(
                null,
                printArgv(MARKER),
                null,
                GLib.SpawnFlags.DEFAULT,
                null,
                -1,
                -1,
                -1,
                null,
                null,
            ),
            MARKER,
        );
    });
});
