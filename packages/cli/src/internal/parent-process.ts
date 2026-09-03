import { readFileSync } from "node:fs";

type ProcessIdentity = {
    pid: number;
    parentId: number;
    processGroupId: number;
    startTime: string;
    state: string;
};

type ProcessGroupOwner = Pick<ProcessIdentity, "pid" | "startTime">;
type ProcessGroupOwnerCapture = { isCaptured: true; owner: ProcessGroupOwner | undefined } |
    { isCaptured: false; error: Error };

const initialParentId = process.ppid;
const STOPPED_PROCESS_STATES: Set<string> = new Set(["Z", "X", "x"]);

const processIdentity = (pid: number): ProcessIdentity => {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
    const state = fields[0];
    const parentId = Number(fields[1]);
    const processGroupId = Number(fields[2]);
    const startTime = fields[19];

    if (
        state === undefined ||
        startTime === undefined ||
        !Number.isSafeInteger(parentId) ||
        !Number.isSafeInteger(processGroupId)
    ) {
        throw new Error(`Failed to identify process ${String(pid)}`);
    }

    return { pid, parentId, processGroupId, startTime, state };
};

const ancestorFor = (process: ProcessIdentity, ancestorId: number): ProcessIdentity | undefined => {
    let current = process;

    while (current.parentId > 1) {
        const parent = processIdentity(current.parentId);

        if (parent.pid === ancestorId) {
            return parent;
        }

        current = parent;
    }

    return undefined;
};

const processGroupOwner = (process: ProcessIdentity): ProcessGroupOwner => {
    if (process.processGroupId !== process.pid || STOPPED_PROCESS_STATES.has(process.state)) {
        throw new Error(`Failed to identify process group ${String(process.pid)}`);
    }

    return { pid: process.pid, startTime: process.startTime };
};

const processGroupOwnerFor = (process: ProcessIdentity): ProcessGroupOwner | undefined => {
    if (process.processGroupId === process.pid) {
        return undefined;
    }

    const groupLeader = processGroupOwner(processIdentity(process.processGroupId));
    const owner = ancestorFor(process, groupLeader.pid);

    if (owner !== undefined) {
        return groupLeader;
    }

    const currentGroupLeader = processGroupOwner(processIdentity(groupLeader.pid));

    if (currentGroupLeader.startTime !== groupLeader.startTime) {
        throw new Error(`Failed to identify process group ${String(groupLeader.pid)}`);
    }

    return undefined;
};

const captureProcessGroupOwner = (): ProcessGroupOwnerCapture => {
    try {
        const initialProcess = processIdentity(process.pid);

        if (initialProcess.parentId !== initialParentId) {
            throw new Error("The process that launched GTKX exited during startup");
        }

        return { isCaptured: true, owner: processGroupOwnerFor(initialProcess) };
    } catch (error) {
        return {
            isCaptured: false,
            error: error instanceof Error ? error : new Error("Failed to identify the process that launched GTKX"),
        };
    }
};

const capturedProcessGroupOwner = captureProcessGroupOwner();

const getInitialProcessGroupOwner = (): ProcessGroupOwner | undefined => {
    if (!capturedProcessGroupOwner.isCaptured) {
        throw capturedProcessGroupOwner.error;
    }

    return capturedProcessGroupOwner.owner;
};

export { getInitialProcessGroupOwner, initialParentId };
