import { killMarkedProcesses, killMarkedProcessRun } from "./kill-marked-processes.ts";
import {
    type CleanupDirectoryIdentity,
    killProcessGroup,
    type ProcessGroupIdentity,
    removeCleanupDirectory,
} from "./kill-process-group.ts";

const GUARD_PREFIX = process.argv[2] ?? "";
const WATCHED_SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"] as const satisfies NodeJS.Signals[];
type GuardJob = {
    marker: string;
    processGroup: ProcessGroupIdentity;
    cleanupDirectories: CleanupDirectoryIdentity[];
};

const state: { bufferedCommands: string; isSweeping: boolean; jobs: Map<string, GuardJob> } = {
    bufferedCommands: "",
    isSweeping: false,
    jobs: new Map(),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

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
    value.cleanupDirectories.every(isCleanupDirectoryIdentity);

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
        killProcessGroup(job.processGroup);
        killMarkedProcesses(job.marker);
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

const sweep = (): void => {
    if (state.isSweeping) {
        return;
    }

    state.isSweeping = true;
    applyCommand(state.bufferedCommands);
    killJobs();

    if (GUARD_PREFIX.length > 0) {
        killMarkedProcessRun(GUARD_PREFIX);
    }

    removeCleanupDirectories();
    process.exit(0);
};

process.stdin.resume();
process.stdin.on("data", receiveCommands);
process.stdin.on("end", sweep);
process.stdin.on("error", sweep);

for (const signal of WATCHED_SIGNALS) {
    process.on(signal, sweep);
}
