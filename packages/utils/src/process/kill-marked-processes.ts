import { readdirSync, readFileSync } from "node:fs";

const PROCESS_MARKER = "GTKX_PROCESS_GUARD";
const MAX_KILL_PASSES = 8;

const isMarked = (pid: number, prefix: string): boolean => {
    try {
        return readFileSync(`/proc/${String(pid)}/environ`, "utf8")
            .split("\0")
            .some((assignment) => assignment.startsWith(prefix));
    } catch {
        return false;
    }
};

const markedPids = (prefix: string): number[] =>
    readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1 && pid !== process.pid)
        .filter((pid) => isMarked(pid, prefix));

const killPid = (pid: number): void => {
    try {
        process.kill(pid, "SIGKILL");
    } catch {
        return;
    }
};

function killMarkedProcesses(prefix: string): void {
    for (let pass = 0; pass < MAX_KILL_PASSES; pass += 1) {
        const pids = markedPids(prefix);

        if (pids.length === 0) {
            return;
        }

        for (const pid of pids) {
            killPid(pid);
        }
    }
}

export { PROCESS_MARKER, killMarkedProcesses };
