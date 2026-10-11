import type { CleanupDirectoryIdentity, ProcessGroupIdentity } from "./kill-process-group.ts";
import type { ProcessIdentity } from "./process-status.ts";

type GuardSignal = "SIGKILL" | "SIGCONT";

type ProcessWatch = {
    owner: ProcessIdentity;
    target: ProcessIdentity;
};

type GuardJob = {
    marker: string;
    processGroup: ProcessGroupIdentity;
    cleanupDirectories: CleanupDirectoryIdentity[];
    signal: GuardSignal;
};

export { type GuardJob, type GuardSignal, type ProcessWatch };

const OWNER_GUARD_STATE = { starting: 0, ready: 1, invalid: 2, closed: 3, signalling: 4 } as const;
type OwnerGuardData = ProcessWatch & { state: Int32Array<SharedArrayBuffer> };

export { OWNER_GUARD_STATE, type OwnerGuardData };
