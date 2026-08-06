import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { spawnWithParentDeathSignal } from "../src/process/index.js";

type Fixture = { spawned: ChildProcess[]; directories: string[]; markers: string[] };
type Tree = { marker: string; directory: string };

const POLL_INTERVAL_MS = 20;
const POLL_TIMEOUT_MS = 3000;
const SPAWN_MODULE_URL = pathToFileURL(join(import.meta.dirname, "..", "src", "process", "index.ts")).href;
const ESCAPEE_SOURCE = "setInterval(() => undefined, 1000);\n";

const TREE_SOURCE = [
    'import { spawn } from "node:child_process";',
    "const [escapee, marker] = process.argv.slice(2);",
    'spawn(process.execPath, [escapee, marker], { detached: true, stdio: "ignore" }).unref();',
    "setInterval(() => undefined, 1000);",
    "",
].join("\n");

const fixture: Fixture = { spawned: [], directories: [], markers: [] };

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const hasMarker = (entry: string, marker: string): boolean => {
    try {
        return readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0").includes(marker);
    } catch {
        return false;
    }
};

const getMarkedPids = (marker: string): string[] =>
    readdirSync("/proc").filter((entry) => /^\d+$/.test(entry) && hasMarker(entry, marker));

const pollUntil = async (isSatisfied: () => boolean): Promise<boolean> => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline && !isSatisfied()) {
        await delay(POLL_INTERVAL_MS);
    }

    return isSatisfied();
};

const waitForTree = (tree: Tree): Promise<boolean> => pollUntil(() => getMarkedPids(tree.marker).length > 0);
const waitForReaping = (tree: Tree): Promise<boolean> => pollUntil(() => getMarkedPids(tree.marker).length === 0);

const writeTree = (): Tree => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-pdeath-"));
    fixture.directories.push(directory);
    const marker = `gtkx-escapee-${String(process.pid)}-${String(fixture.markers.length)}`;
    fixture.markers.push(marker);
    writeFileSync(join(directory, "escapee.mjs"), ESCAPEE_SOURCE);
    writeFileSync(join(directory, "tree.mjs"), TREE_SOURCE);

    return { marker, directory };
};

const getTreeArgs = (tree: Tree): string[] => [
    join(tree.directory, "tree.mjs"),
    join(tree.directory, "escapee.mjs"),
    tree.marker,
];

const writeParent = (tree: Tree): string => {
    const path = join(tree.directory, "parent.mjs");

    writeFileSync(
        path,
        [
            `import { spawnWithParentDeathSignal } from ${JSON.stringify(SPAWN_MODULE_URL)};`,
            `spawnWithParentDeathSignal(process.execPath, ${JSON.stringify(getTreeArgs(tree))});`,
            "setInterval(() => undefined, 1000);",
            "",
        ].join("\n"),
    );

    return path;
};

const killMarked = (marker: string): void => {
    for (const pid of getMarkedPids(marker)) {
        try {
            process.kill(Number(pid), "SIGKILL");
        } catch {
            continue;
        }
    }
};

const cleanUp = (): void => {
    for (const child of fixture.spawned) {
        child.kill("SIGKILL");
    }

    for (const marker of fixture.markers) {
        killMarked(marker);
    }

    for (const directory of fixture.directories) {
        rmSync(directory, { recursive: true, force: true });
    }

    fixture.spawned.length = 0;
    fixture.directories.length = 0;
    fixture.markers.length = 0;
};

const readStderr = (child: ChildProcess): Promise<string> =>
    new Promise((resolve) => {
        let text = "";
        child.stderr?.setEncoding("utf8");

        child.stderr?.on("data", (chunk: string) => {
            text += chunk;
        });

        child.on("exit", () => {
            resolve(text);
        });
    });

afterEach(() => {
    cleanUp();
});

describe("spawnWithParentDeathSignal reaping", () => {
    it("kills a descendant that escaped into its own session when the handle is killed", async () => {
        const tree = writeTree();
        const child = spawnWithParentDeathSignal(process.execPath, getTreeArgs(tree));
        fixture.spawned.push(child);
        expect(await waitForTree(tree)).toBe(true);
        child.kill("SIGKILL");
        expect(await waitForReaping(tree)).toBe(true);
    });

    it("kills a descendant that escaped into its own session when the parent dies", async () => {
        const tree = writeTree();
        const parent = spawn(process.execPath, [writeParent(tree)], { stdio: "inherit" });
        fixture.spawned.push(parent);
        expect(await waitForTree(tree)).toBe(true);
        parent.kill("SIGKILL");
        expect(await waitForReaping(tree)).toBe(true);
    });

    it("leaves the calling process alive once the tree is reaped", async () => {
        const tree = writeTree();
        const child = spawnWithParentDeathSignal(process.execPath, getTreeArgs(tree));
        fixture.spawned.push(child);
        expect(await waitForTree(tree)).toBe(true);
        child.kill("SIGKILL");
        expect(await waitForReaping(tree)).toBe(true);
        expect(process.kill(process.pid, 0)).toBe(true);
    });
});

describe("spawnWithParentDeathSignal wiring", () => {
    it("propagates the command's exit code", async () => {
        const child = spawnWithParentDeathSignal(process.execPath, ["-e", "process.exit(42)"]);
        fixture.spawned.push(child);

        const code = await new Promise<number | null>((resolve) => {
            child.on("exit", resolve);
        });

        expect(code).toBe(42);
    });

    it("forwards a piped stream from the command", async () => {
        const child = spawnWithParentDeathSignal(process.execPath, ["-e", "process.stderr.write('piped')"], {
            stdio: ["ignore", "ignore", "pipe"],
        });

        fixture.spawned.push(child);
        expect(await readStderr(child)).toBe("piped");
    });

    it("throws a named error when the command is not on PATH", () => {
        expect(() => spawnWithParentDeathSignal("gtkx-nonexistent-binary-xyz", [])).toThrow(
            /gtkx-nonexistent-binary-xyz/,
        );
    });
});
