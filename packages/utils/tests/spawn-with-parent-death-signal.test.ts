import type { ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnWithParentDeathSignal } from "../src/process/index.js";

type Fixture = { spawned: ChildProcess[]; directories: string[] };
type Grandchild = { wrapper: ChildProcess; pid: number };

const POLL_INTERVAL_MS = 20;
const POLL_TIMEOUT_MS = 2000;

const isProcessAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);

        return true;
    } catch {
        return false;
    }
};

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const pollUntil = async (isSatisfied: () => boolean): Promise<boolean> => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (isSatisfied()) {
            return true;
        }

        await delay(POLL_INTERVAL_MS);
    }

    return false;
};

const getProcessGroup = (pid: number): number | null => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        const group = Number(fields[2]);

        return Number.isNaN(group) ? null : group;
    } catch {
        return null;
    }
};

const readPid = (path: string): number | null => {
    try {
        const text = readFileSync(path, "utf8").trim();

        return text.length > 0 ? Number(text) : null;
    } catch {
        return null;
    }
};

const startGrandchild = async (fixture: Fixture): Promise<Grandchild> => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-pdeath-"));
    fixture.directories.push(directory);
    const pidPath = join(directory, "grandchild.pid");
    const wrapper = spawnWithParentDeathSignal("sh", ["-c", `sleep 60 & echo $! > ${pidPath}; wait`]);
    fixture.spawned.push(wrapper);
    const hasPid = await pollUntil(() => readPid(pidPath) !== null);
    expect(hasPid).toBe(true);
    const pid = readPid(pidPath);
    expect(pid).not.toBeNull();

    return { wrapper, pid: pid ?? 0 };
};

describe("spawnWithParentDeathSignal", () => {
    const fixture: Fixture = { spawned: [], directories: [] };

    afterEach(() => {
        for (const child of fixture.spawned) {
            child.kill("SIGKILL");
        }

        for (const directory of fixture.directories) {
            rmSync(directory, { recursive: true, force: true });
        }

        fixture.spawned.length = 0;
        fixture.directories.length = 0;
    });

    it("kills the whole process group, not just the direct child", async () => {
        const { wrapper, pid } = await startGrandchild(fixture);
        expect(isProcessAlive(pid)).toBe(true);
        wrapper.kill("SIGTERM");
        const hasDied = await pollUntil(() => !isProcessAlive(pid));
        expect(hasDied).toBe(true);
    });

    it("leads its own process group without relying on the shell's job control", async () => {
        const { wrapper } = await startGrandchild(fixture);
        const pid = wrapper.pid ?? 0;
        expect(pid).toBeGreaterThan(0);
        expect(getProcessGroup(pid)).toBe(pid);
    });

    it("leaves the calling process outside the group it kills", async () => {
        const { wrapper, pid } = await startGrandchild(fixture);
        expect(pid).not.toBe(process.pid);
        wrapper.kill("SIGTERM");
        await pollUntil(() => !isProcessAlive(pid));
        expect(isProcessAlive(process.pid)).toBe(true);
    });

    it("throws a named error when the command is not on PATH", () => {
        expect(() => spawnWithParentDeathSignal("gtkx-nonexistent-binary-xyz", [])).toThrow(
            /gtkx-nonexistent-binary-xyz/,
        );
    });
});
