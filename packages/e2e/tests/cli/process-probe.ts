import { readdirSync, readFileSync } from "node:fs";

type ProcessIdentity = {
    parentId: number;
    processGroupId: number;
    sessionId: number;
    startTime: string;
    state: string;
};
type ProcessEntry = ProcessIdentity & { pid: number; args: string[] };
type RunningProcess = Pick<ProcessEntry, "pid" | "startTime">;

const PROCESS_TIMEOUT_MS = 30_000;
const POLL_MS = 50;
const STOPPED_STATES: ReadonlySet<string> = new Set(["Z", "X", "x"]);

const processIdentity = (pid: number): ProcessIdentity | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const state = fields[0];
        const parentId = Number(fields[1]);
        const processGroupId = Number(fields[2]);
        const sessionId = Number(fields[3]);
        const startTime = fields[19];

        return state !== undefined &&
            startTime !== undefined &&
            Number.isSafeInteger(parentId) &&
            Number.isSafeInteger(processGroupId) &&
            Number.isSafeInteger(sessionId)
            ? { parentId, processGroupId, sessionId, startTime, state }
            : undefined;
    } catch {
        return undefined;
    }
};

const processArguments = (pid: number): string[] | undefined => {
    try {
        return readFileSync(`/proc/${String(pid)}/cmdline`)
            .toString()
            .split("\0")
            .filter((argument) => argument.length > 0);
    } catch {
        return undefined;
    }
};

const processEntries = (): ProcessEntry[] =>
    readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1)
        .flatMap((pid): ProcessEntry[] => {
            const identity = processIdentity(pid);
            const args = identity === undefined ? undefined : processArguments(pid);

            return identity === undefined || args === undefined ? [] : [{ pid, ...identity, args }];
        });

const childProcesses = (parentId: number): ProcessEntry[] =>
    processEntries().filter((entry) => entry.parentId === parentId);

const isRunning = (entry: RunningProcess): boolean => {
    const current = processIdentity(entry.pid);

    return current?.startTime === entry.startTime && !STOPPED_STATES.has(current.state);
};

const isPidRunning = (pid: number): boolean => {
    const state = processIdentity(pid)?.state;

    return state !== undefined && !STOPPED_STATES.has(state);
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

export {
    childProcesses,
    isPidRunning,
    isRunning,
    type ProcessEntry,
    processEntries,
    processIdentity,
    waitUntil,
};
