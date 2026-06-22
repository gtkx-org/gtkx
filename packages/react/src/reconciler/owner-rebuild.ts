import { scheduleFlush } from "./commit-flush.js";
import { closestInstance, type Node } from "./state.js";

const rebuildsByOwner = new WeakMap<Node, () => void>();

export const scheduleOwnerRebuild = (
    node: Node,
    ownerPredicate: (candidate: Node) => boolean,
    createOwnerRebuild: (owner: Node) => () => void,
): void => {
    const owner = closestInstance(node, ownerPredicate);
    if (!owner) return;
    let rebuild = rebuildsByOwner.get(owner);
    if (!rebuild) {
        rebuild = createOwnerRebuild(owner);
        rebuildsByOwner.set(owner, rebuild);
    }
    scheduleFlush(rebuild);
};
