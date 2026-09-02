import { readdirSync, readFileSync } from "node:fs";

type ProcessIdentity = {
    pid: number;
    sessionId: number;
    startTime: string;
};

type MarkerMatcher = (assignment: string) => boolean;

const PROCESS_MARKER = "GTKX_PROCESS_GUARD";
const MAX_KILL_PASSES = 8;
const JOB_ID_PATTERN = /^[0-9a-f]{8}$/;

const processIdentity = (pid: number): ProcessIdentity | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const sessionId = Number(fields[3]);
        const startTime = fields[19];

        return startTime !== undefined && Number.isSafeInteger(sessionId)
            ? { pid, sessionId, startTime }
            : undefined;
    } catch {
        return undefined;
    }
};

const isMarked = (pid: number, isMatch: MarkerMatcher): boolean => {
    try {
        return readFileSync(`/proc/${String(pid)}/environ`, "utf8")
            .split("\0")
            .some((assignment) => isMatch(assignment));
    } catch {
        return false;
    }
};

const markedProcesses = (isMatch: MarkerMatcher): ProcessIdentity[] =>
    readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1 && pid !== process.pid)
        .filter((pid) => isMarked(pid, isMatch))
        .map((pid) => processIdentity(pid))
        .filter((identity): identity is ProcessIdentity => identity !== undefined);

const killProcess = (identity: ProcessIdentity, isMatch: MarkerMatcher): void => {
    if (!isMarked(identity.pid, isMatch)) {
        return;
    }

    const current = processIdentity(identity.pid);

    if (
        current?.sessionId !== identity.sessionId ||
        current.startTime !== identity.startTime
    ) {
        return;
    }

    try {
        process.kill(identity.pid, "SIGKILL");
    } catch {
        return;
    }
};

const killMatchingProcesses = (isMatch: MarkerMatcher): void => {
    for (let pass = 0; pass < MAX_KILL_PASSES; pass += 1) {
        const processes = markedProcesses(isMatch);

        if (processes.length === 0) {
            return;
        }

        for (const identity of processes) {
            killProcess(identity, isMatch);
        }
    }
};

const killMarkedProcesses = (marker: string): void => {
    killMatchingProcesses((assignment) => assignment === marker);
};

const killMarkedProcessRun = (runPrefix: string): void => {
    killMatchingProcesses((assignment) =>
        assignment.startsWith(runPrefix) && JOB_ID_PATTERN.test(assignment.slice(runPrefix.length)),
    );
};

export { PROCESS_MARKER, killMarkedProcessRun, killMarkedProcesses };
