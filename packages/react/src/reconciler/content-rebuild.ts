import { scheduleFlush } from "./commit-flush.js";
import { closestInstance, type Node } from "./state.js";

const rebuildsByContentOwner = new WeakMap<Node, () => void>();

export const scheduleContentRebuild = <T extends Node>(
    node: Node,
    isContentOwner: (candidate: Node) => candidate is T,
    createRebuild: (owner: T) => () => void,
): void => {
    const owner = closestInstance(node, isContentOwner);
    if (!owner) return;
    let rebuild = rebuildsByContentOwner.get(owner);
    if (!rebuild) {
        rebuild = createRebuild(owner);
        rebuildsByContentOwner.set(owner, rebuild);
    }
    scheduleFlush(rebuild);
};
