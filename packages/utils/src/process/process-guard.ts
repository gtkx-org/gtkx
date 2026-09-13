import type { GuardJob, ProcessWatch } from "./guard-protocol.ts";
import { killMarkedProcesses, killMarkedProcessRun } from "./kill-marked-processes.ts";
import {
    type CleanupDirectoryIdentity,
    killProcessGroup,
    processGroupIdentity,
    removeCleanupDirectory,
} from "./kill-process-group.ts";
import { type ProcessIdentity, readProcessIdentity } from "./process-status.ts";

const GUARD_PREFIX = process.argv[2] ?? "";
const PROCESS_WATCH_ARGUMENT = process.argv[3];
const WATCHED_SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"] as const satisfies NodeJS.Signals[];
const OWNER_POLL_INTERVAL_MS = 50;
const SUPERVISOR_EXIT_TIMEOUT_MS = 2000;

const state: { bufferedCommands: string; isSweeping: boolean; jobs: Map<string, GuardJob> } = {
    bufferedCommands: "",
    isSweeping: false,
    jobs: new Map(),
};

const parseProcessWatch = (): ProcessWatch | undefined => {
    if (PROCESS_WATCH_ARGUMENT === undefined) {
        return undefined;
    }

    return JSON.parse(PROCESS_WATCH_ARGUMENT) as ProcessWatch;
};

const isCurrentProcess = (identity: ProcessIdentity): boolean =>
    readProcessIdentity(identity.pid)?.startTime === identity.startTime;

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
    let value: GuardJob;

    try {
        value = JSON.parse(command.slice(1)) as GuardJob;
    } catch {
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
