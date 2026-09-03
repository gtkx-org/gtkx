import { resolveExecutable } from "@gtkx/utils";
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliProject, STORE_LIBRARIES } from "./cli-project.js";

type ProcessIdentity = {
    pid: number;
    parentId: number;
    processGroupId: number;
    sessionId: number;
    startTime: string;
    state: string;
    args: string[];
};

const CLI_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PROCESS_TIMEOUT_MS = 120_000;
const POLL_MS = 50;
const READY_MARKER = "gtkx-wrapper-ready";
const OWNER_ENV = "GTKX_DEV_PROCESS_OWNER";
const ENTRY_SOURCE = String.raw`process.stdout.write("${READY_MARKER}\n");
setInterval(() => undefined, 1000);
`;

const processIdentity = (pid: number): ProcessIdentity | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const state = fields[0];
        const parentId = Number(fields[1]);
        const processGroupId = Number(fields[2]);
        const sessionId = Number(fields[3]);
        const startTime = fields[19];
        const args = readFileSync(`/proc/${String(pid)}/cmdline`)
            .toString()
            .split("\0")
            .filter((argument) => argument.length > 0);

        return state !== undefined &&
            startTime !== undefined &&
            Number.isSafeInteger(parentId) &&
            Number.isSafeInteger(processGroupId) &&
            Number.isSafeInteger(sessionId)
            ? { pid, parentId, processGroupId, sessionId, startTime, state, args }
            : undefined;
    } catch {
        return undefined;
    }
};

const hasOwner = (pid: number, owner: string): boolean => {
    try {
        return readFileSync(`/proc/${String(pid)}/environ`, "utf8")
            .split("\0")
            .includes(`${OWNER_ENV}=${owner}`);
    } catch {
        return false;
    }
};

const ownedProcesses = (owner: string): ProcessIdentity[] =>
    readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1 && hasOwner(pid, owner))
        .map((pid) => processIdentity(pid))
        .filter((identity): identity is ProcessIdentity => identity !== undefined);

const isRunning = (identity: ProcessIdentity): boolean => {
    const current = processIdentity(identity.pid);

    return current?.startTime === identity.startTime &&
        current.state !== "Z" &&
        current.state !== "X" &&
        current.state !== "x";
};

const waitUntil = async (isReady: () => boolean): Promise<void> => {
    const deadline = Date.now() + PROCESS_TIMEOUT_MS;

    while (!isReady() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    if (!isReady()) {
        throw new Error("Process condition did not settle");
    }
};

const captureOutput = (child: ChildProcess): (() => string) => {
    let output = "";
    const append = (chunk: Buffer): void => {
        output += chunk.toString();
    };

    child.stdout?.on("data", append);
    child.stderr?.on("data", append);

    return () => output;
};

const installCliBin = (nodeModules: string): void => {
    const packagePath = join(nodeModules, "@gtkx", "cli");
    const binPath = join(nodeModules, ".bin", "gtkx");
    mkdirSync(dirname(packagePath), { recursive: true });
    mkdirSync(dirname(binPath), { recursive: true });
    symlinkSync(CLI_ROOT, packagePath, "dir");
    symlinkSync(join(CLI_ROOT, "bin", "gtkx.js"), binPath);
};

const killOwnedProcess = (identity: ProcessIdentity, owner: string): void => {
    if (!isRunning(identity) || !hasOwner(identity.pid, owner)) {
        return;
    }

    try {
        process.kill(identity.pid, "SIGKILL");
    } catch {
        return;
    }
};

const killOwned = async (owner: string): Promise<void> => {
    for (let pass = 0; pass < 8; pass += 1) {
        const processes = ownedProcesses(owner);

        if (processes.length === 0) {
            return;
        }

        for (const identity of processes) {
            killOwnedProcess(identity, owner);
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
};

const expectWrapperShutdown = async (signal: "SIGTERM" | "SIGKILL"): Promise<void> => {
    const config =
        "export default { applicationId: \"com.gtkx.devowner\", " +
        `libraries: ${JSON.stringify(STORE_LIBRARIES)} };\n`;
    using project = createCliProject({
        prefix: "gtkx-dev-owner-",
        config,
        files: { "src/index.tsx": ENTRY_SOURCE },
        hasStore: true,
    });
    installCliBin(project.nodeModules);
    const owner = randomBytes(12).toString("hex");
    const child = spawn(resolveExecutable("npx"), ["gtkx", "dev"], {
        cwd: project.root,
        detached: true,
        env: {
            ...process.env,
            [OWNER_ENV]: owner,
            NPM_CONFIG_OFFLINE: "true",
            NPM_CONFIG_UPDATE_NOTIFIER: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });
    const output = captureOutput(child);

    try {
        await waitUntil(() => output().includes(READY_MARKER));
        const processes = ownedProcesses(owner);
        expect(processes.some((entry) => entry.pid === child.pid)).toBe(true);
        expect(processes.some((entry) => entry.args.some((argument) => argument.includes("gtkx-dev-runner")))).toBe(
            true,
        );
        child.kill(signal);
        await waitUntil(
            () => processes.every((entry) => !isRunning(entry)) && ownedProcesses(owner).length === 0,
        );
        expect(ownedProcesses(owner)).toEqual([]);
    } finally {
        await killOwned(owner);
    }
};

describe("gtkx dev process ownership", () => {
    it("stops through a catchable npx wrapper signal", async () => {
        await expectWrapperShutdown("SIGTERM");
    });

    it("stops when its npx wrapper is hard-killed", async () => {
        await expectWrapperShutdown("SIGKILL");
    });
});
