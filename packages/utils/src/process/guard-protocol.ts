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
