import { type ChildProcess, spawn, type StdioOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Socket } from "node:net";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { killMarkedProcesses, PROCESS_MARKER } from "./kill-marked-processes.ts";
import {
    type CleanupDirectoryIdentity,
    cleanupDirectoryIdentity,
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    removeCleanupDirectory,
} from "./kill-process-group.ts";
import { resolveExecutable } from "./resolve-executable.ts";

type ParentDeathSpawnOptions = {
    stdio?: StdioOptions;
    env?: NodeJS.ProcessEnv;
    cleanupDirectories?: string[];
};

type GuardJob = {
    marker: string;
    processGroup: ProcessGroupIdentity;
    cleanupDirectories: CleanupDirectoryIdentity[];
};

type GuardState = {
    child?: ChildProcess | undefined;
    jobs: Map<string, GuardJob>;
};

type SpawnRollback = {
    child: ChildProcess;
    marker: string;
    processGroup?: ProcessGroupIdentity | undefined;
    cleanupDirectories?: CleanupDirectoryIdentity[] | undefined;
};

const MODULE_PATH = fileURLToPath(import.meta.url);
const GUARD_PATH = join(dirname(MODULE_PATH), `process-guard${extname(MODULE_PATH)}`);
const RUN_ID = randomBytes(8).toString("hex");
const RUN_PREFIX = `${PROCESS_MARKER}=${RUN_ID}/`;
const guard: GuardState = { jobs: new Map() };

const writeGuardCommand = (child: ChildProcess, operation: "+" | "-", job: GuardJob): void => {
    child.stdin?.write(`${operation}${JSON.stringify(job)}\n`);
};

const releaseGuard = (child: ChildProcess): void => {
    child.unref();
    const { stdin } = child;

    if (stdin instanceof Socket) {
        stdin.unref();
    }
};

const startGuard = (): void => {
    if (guard.child) {
        return;
    }

    const child = spawn(process.execPath, [GUARD_PATH, RUN_PREFIX], {
        detached: true,
        stdio: ["pipe", "ignore", "ignore"],
    });

    child.on("error", () => {
        if (guard.child === child) {
            guard.child = undefined;
        }
    });

    child.on("exit", () => {
        if (guard.child === child) {
            guard.child = undefined;
        }
    });

    child.stdin.on("error", () => {
        if (guard.child === child) {
            guard.child = undefined;
        }
    });

    guard.child = child;

    for (const job of guard.jobs.values()) {
        writeGuardCommand(child, "+", job);
    }

    releaseGuard(child);
};

const registerJob = (job: GuardJob): void => {
    guard.jobs.set(job.marker, job);

    if (guard.child) {
        writeGuardCommand(guard.child, "+", job);
    }
};

const unregisterJob = (job: GuardJob): void => {
    guard.jobs.delete(job.marker);

    if (guard.child) {
        writeGuardCommand(guard.child, "-", job);
    }
};

const rollbackSpawn = ({ child, marker, processGroup, cleanupDirectories = [] }: SpawnRollback): void => {
    if (processGroup === undefined) {
        child.kill("SIGKILL");
    } else {
        killProcessGroup(processGroup);
    }

    killMarkedProcesses(marker);

    for (const identity of cleanupDirectories) {
        removeCleanupDirectory(identity);
    }
};

function spawnWithParentDeathSignal(
    command: string,
    args: string[],
    options: ParentDeathSpawnOptions = {},
): ChildProcess {
    const executable = resolveExecutable(command);
    const setpriv = resolveExecutable("setpriv");
    const jobValue = `${RUN_ID}/${randomBytes(4).toString("hex")}`;
    const marker = `${PROCESS_MARKER}=${jobValue}`;
    startGuard();

    const child = spawn(setpriv, ["--pdeathsig", "SIGKILL", executable, ...args], {
        detached: true,
        stdio: options.stdio ?? "ignore",
        env: { ...(options.env ?? process.env), [PROCESS_MARKER]: jobValue },
    });

    const processGroupId = child.pid;
    const group = processGroupId === undefined ? undefined : processGroupIdentity(processGroupId);

    if (group === undefined) {
        rollbackSpawn({ child, marker });
        throw new Error(`Failed to identify process group for ${command}`);
    }

    const cleanupDirectories = (options.cleanupDirectories ?? []).map((path) => cleanupDirectoryIdentity(path));

    if (cleanupDirectories.includes(undefined)) {
        const captured = cleanupDirectories.filter(
            (identity): identity is CleanupDirectoryIdentity => identity !== undefined,
        );
        rollbackSpawn({ child, marker, processGroup: group, cleanupDirectories: captured });
        throw new Error(`Failed to identify a cleanup directory for ${command}`);
    }

    const job: GuardJob = {
        marker,
        processGroup: group,
        cleanupDirectories: cleanupDirectories.filter((identity) => identity !== undefined),
    };
    registerJob(job);

    child.on("exit", () => {
        killMarkedProcesses(job.marker);
        unregisterJob(job);
    });

    return child;
}

export { spawnWithParentDeathSignal };
