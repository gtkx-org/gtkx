import { captureProcessGroupOwner, type ProcessIdentity } from "@gtkx/utils";

type ProcessGroupOwnerCapture =
    | { isCaptured: true; owner: ProcessIdentity | undefined }
    | { isCaptured: false; error: Error };

const initialParentId = process.ppid;

const captureInitialOwner = (): ProcessGroupOwnerCapture => {
    try {
        return { isCaptured: true, owner: captureProcessGroupOwner(process.pid, initialParentId) };
    } catch (error) {
        return {
            isCaptured: false,
            error: error instanceof Error ? error : new Error("Failed to identify the process that launched GTKX"),
        };
    }
};

const capturedProcessGroupOwner = captureInitialOwner();

const getInitialProcessGroupOwner = (): ProcessIdentity | undefined => {
    if (!capturedProcessGroupOwner.isCaptured) {
        throw capturedProcessGroupOwner.error;
    }
    return capturedProcessGroupOwner.owner;
};

export { getInitialProcessGroupOwner, initialParentId };
