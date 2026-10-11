import { readFileSync } from "node:fs";

type ProcessIdentity = {
    pid: number;
    startTime: string;
};

type ProcessStatus = ProcessIdentity & {
    parentId: number;
    processGroupId: number;
    state: string;
};

const REAPED_STATES: ReadonlySet<string> = new Set(["Z", "X", "x"]);

const readProcessStatFields = (pid: number): string[] | undefined => {
    if (!Number.isSafeInteger(pid) || pid <= 0) {
        return undefined;
    }

    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const separator = stat.lastIndexOf(") ");

        return separator === -1
            ? undefined
            : stat
                  .slice(separator + 2)
                  .trim()
                  .split(/\s+/);
    } catch {
        return undefined;
    }
};

const isReapedState = (state: string | undefined): boolean => state === undefined || REAPED_STATES.has(state);

const isProcessAlive = (pid: number | undefined): boolean =>
    pid !== undefined && pid > 1 && !isReapedState(readProcessStatFields(pid)?.[0]);

const readProcessIdentity = (pid: number): ProcessIdentity | undefined => {
    const fields = readProcessStatFields(pid);
    const startTime = fields?.[19];

    return startTime === undefined || isReapedState(fields?.[0]) ? undefined : { pid, startTime };
};

const readProcessStatus = (pid: number): ProcessStatus | undefined => {
    const fields = readProcessStatFields(pid);
    const state = fields?.[0];
    const startTime = fields?.[19];
    const parentId = Number(fields?.[1]);
    const processGroupId = Number(fields?.[2]);
    if (
        state === undefined ||
        startTime === undefined ||
        !Number.isSafeInteger(parentId) ||
        parentId < 0 ||
        !Number.isSafeInteger(processGroupId) ||
        processGroupId <= 0
    ) {
        return undefined;
    }
    return { pid, parentId, processGroupId, startTime, state };
};

export {
    isProcessAlive,
    type ProcessIdentity,
    type ProcessStatus,
    readProcessIdentity,
    readProcessStatFields,
    readProcessStatus,
};
