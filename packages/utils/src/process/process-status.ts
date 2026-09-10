import { readFileSync } from "node:fs";

const REAPED_STATES: ReadonlySet<string> = new Set(["Z", "X", "x"]);

const readProcessStatFields = (pid: number): string[] | undefined => {
    if (!Number.isSafeInteger(pid) || pid <= 0) {
        return undefined;
    }

    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const separator = stat.lastIndexOf(") ");

        return separator === -1 ? undefined : stat.slice(separator + 2).split(" ");
    } catch {
        return undefined;
    }
};

const isReapedState = (state: string | undefined): boolean => state === undefined || REAPED_STATES.has(state);

const isProcessAlive = (pid: number | undefined): boolean =>
    pid !== undefined && pid > 1 && !isReapedState(readProcessStatFields(pid)?.[0]);

export { isProcessAlive, isReapedState, readProcessStatFields };
