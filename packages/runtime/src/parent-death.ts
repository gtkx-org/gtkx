import { watchProcessGroupOwner } from "@gtkx/utils";
import {
    activateProcessWatch,
    armParentDeath as armNativeParentDeath,
    closeProcessWatch,
    openProcessWatch,
} from "./native.js";

let closeOwnerWatch: (() => void) | undefined;

const armParentDeath = (expectedParent: number, ownerPid?: number, ownerStartTime?: string): boolean => {
    if ((ownerPid === undefined) !== (ownerStartTime === undefined)) {
        throw new Error("Incomplete process group owner identity");
    }
    closeOwnerWatch?.();
    closeOwnerWatch = undefined;
    if (!armNativeParentDeath(expectedParent)) {
        return false;
    }
    if (ownerPid === undefined || ownerStartTime === undefined) {
        return true;
    }
    closeOwnerWatch = watchProcessGroupOwner(
        { pid: ownerPid, startTime: ownerStartTime },
        {
            open: (pid) => openProcessWatch(pid) ?? undefined,
            activate: activateProcessWatch,
            close: closeProcessWatch,
        },
    );
    return closeOwnerWatch !== undefined;
};

export { armParentDeath };
