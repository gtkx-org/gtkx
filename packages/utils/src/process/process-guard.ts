import { readFileSync } from "node:fs";
import { killMarkedProcesses, killMarkedProcessRun } from "./kill-marked-processes.ts";
import {
    type CleanupDirectoryIdentity,
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    removeCleanupDirectory,
} from "./kill-process-group.ts";

const GUARD_PREFIX = process.argv[2] ?? "";
const PROCESS_WATCH_ARGUMENT = process.argv[3];
const WATCHED_SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"] as const satisfies NodeJS.Signals[];
const OWNER_POLL_INTERVAL_MS = 50;
const SUPERVISOR_EXIT_TIMEOUT_MS = 2000;

type ProcessIdentity = {
    pid: number;
    startTime: string;
};

type ProcessWatch = {
    owner: ProcessIdentity;
    target: ProcessIdentity;
};

type GuardJob = {
    marker: string;
    processGroup: ProcessGroupIdentity;
    cleanupDirectories: CleanupDirectoryIdentity[];
    signal: NodeJS.Signals;
};

const state: { bufferedCommands: string; isSweeping: boolean; jobs: Map<string, GuardJob> } = {
    bufferedCommands: "",
    isSweeping: false,
    jobs: new Map(),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isProcessIdentity = (value: unknown): value is ProcessIdentity =>
    isRecord(value) &&
    typeof value.pid === "number" &&
    Number.isSafeInteger(value.pid) &&
    value.pid > 1 &&
    typeof value.startTime === "string" &&
    /^\d+$/.test(value.startTime);

const isProcessWatch = (value: unknown): value is ProcessWatch =>
    isRecord(value) && isProcessIdentity(value.owner) && isProcessIdentity(value.target);

const isProcessGroupIdentity = (value: unknown): value is ProcessGroupIdentity =>
    isRecord(value) &&
    typeof value.processGroupId === "number" &&
    Number.isSafeInteger(value.processGroupId) &&
    value.processGroupId > 1 &&
    typeof value.leaderStartTime === "string" &&
    /^\d+$/.test(value.leaderStartTime);

const isCleanupDirectoryIdentity = (value: unknown): value is CleanupDirectoryIdentity =>
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.device === "string" &&
    typeof value.inode === "string" &&
    typeof value.userId === "string";

const isGuardJob = (value: unknown): value is GuardJob =>
    isRecord(value) &&
    typeof value.marker === "string" &&
    isProcessGroupIdentity(value.processGroup) &&
    Array.isArray(value.cleanupDirectories) &&
    value.cleanupDirectories.every(isCleanupDirectoryIdentity) &&
    (value.signal === "SIGKILL" || value.signal === "SIGCONT");

const parseProcessWatch = (): ProcessWatch | undefined => {
    if (PROCESS_WATCH_ARGUMENT === undefined) {
        return undefined;
    }

    try {
        const value: unknown = JSON.parse(PROCESS_WATCH_ARGUMENT);

        return isProcessWatch(value) ? value : undefined;
    } catch {
        return undefined;
    }
};

const currentProcessIdentity = (pid: number): ProcessIdentity | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ", 20);
        const state = fields[0];
        const startTime = fields[19];

        return startTime !== undefined && state !== undefined && !["Z", "X", "x"].includes(state)
            ? { pid, startTime }
            : undefined;
    } catch {
        return undefined;
    }
};

const isCurrentProcess = (identity: ProcessIdentity): boolean =>
    currentProcessIdentity(identity.pid)?.startTime === identity.startTime;

const killProcess = (identity: ProcessIdentity): void => {
    if (!isCurrentProcess(identity)) {
        return;
    }

    try {
        process.kill(identity.pid, "SIGKILL");
    } catch {
        return;
    }
};

const applyCommand = (command: string): void => {
    const operation = command[0];
    let value: unknown;

    try {
        value = JSON.parse(command.slice(1));
    } catch {
        return;
    }

    if (!isGuardJob(value)) {
        return;
    }

    if (operation === "+") {
        state.jobs.set(value.marker, value);
    } else if (operation === "-") {
        state.jobs.delete(value.marker);
    }
};

const receiveCommands = (chunk: Buffer | string): void => {
    state.bufferedCommands += chunk.toString();
    const commands = state.bufferedCommands.split("\n");
    state.bufferedCommands = commands.pop() ?? "";

    for (const command of commands) {
        applyCommand(command);
    }
};

const killJobs = (): void => {
    for (const job of state.jobs.values()) {
        killProcessGroup(job.processGroup, job.signal);

        if (job.signal === "SIGKILL") {
            killMarkedProcesses(job.marker);
        }
    }
};

const removeCleanupDirectories = (): void => {
    const cleanupDirectories: Map<string, CleanupDirectoryIdentity> = new Map();

    for (const job of state.jobs.values()) {
        for (const identity of job.cleanupDirectories) {
            cleanupDirectories.set(`${identity.device}:${identity.inode}`, identity);
        }
    }

    for (const identity of cleanupDirectories.values()) {
        removeCleanupDirectory(identity);
    }
};

const hasRunningSupervisor = (): boolean => {
    for (const job of state.jobs.values()) {
        if (job.signal !== "SIGCONT") {
            continue;
        }

        const current = processGroupIdentity(job.processGroup.processGroupId);

        if (current?.leaderStartTime === job.processGroup.leaderStartTime) {
            return true;
        }
    }

    return false;
};

const forceSupervisors = (): void => {
    for (const job of state.jobs.values()) {
        if (job.signal === "SIGCONT") {
            killProcessGroup(job.processGroup);
        }
    }
};

const finishSweep = (): void => {
    if (GUARD_PREFIX.length > 0) {
        killMarkedProcessRun(GUARD_PREFIX);
    }

    removeCleanupDirectories();
    process.exit(0);
};

const awaitSupervisors = (deadline: number): void => {
    if (hasRunningSupervisor() && Date.now() < deadline) {
        setTimeout(() => {
            awaitSupervisors(deadline);
        }, OWNER_POLL_INTERVAL_MS);

        return;
    }

    forceSupervisors();
    finishSweep();
};

const sweep = (target?: ProcessIdentity): void => {
    if (state.isSweeping) {
        return;
    }

    state.isSweeping = true;
    applyCommand(state.bufferedCommands);

    if (target !== undefined) {
        killProcess(target);
    }

    killJobs();
    awaitSupervisors(Date.now() + SUPERVISOR_EXIT_TIMEOUT_MS);
};

const watch = parseProcessWatch();

const startOwnerPoll = (): void => {
    if (watch === undefined) {
        return;
    }

    const ownerPoll = setInterval(() => {
        if (isCurrentProcess(watch.owner)) {
            return;
        }

        clearInterval(ownerPoll);
        sweep(watch.target);
    }, OWNER_POLL_INTERVAL_MS);

    if (!isCurrentProcess(watch.owner)) {
        clearInterval(ownerPoll);
        sweep(watch.target);
    }
};

startOwnerPoll();

process.stdin.resume();
process.stdin.on("data", receiveCommands);
process.stdin.on("end", () => {
    sweep();
});
process.stdin.on("error", () => {
    sweep();
});

for (const signal of WATCHED_SIGNALS) {
    process.on(signal, () => {
        sweep();
    });
}
