import { readFileSync } from "node:fs";

const REAPED_STATES: ReadonlySet<string> = new Set(["Z", "X", "x"]);

const processState = (pid: number): string | undefined => {
    if (!Number.isSafeInteger(pid) || pid <= 1) {
        return undefined;
    }

    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");

        return stat.slice(stat.lastIndexOf(") ") + 2).split(" ", 1)[0];
    } catch {
        return undefined;
    }
};

const isProcessAlive = (pid: number | undefined): boolean => {
    const state = pid === undefined ? undefined : processState(pid);

    return state !== undefined && !REAPED_STATES.has(state);
};

export { isProcessAlive };
