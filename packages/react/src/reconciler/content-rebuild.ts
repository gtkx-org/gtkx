import { getOrInsert } from "@gtkx/utils";
import { scheduleFlush } from "./commit-flush.js";
import { findClosest, type Node } from "./state.js";

const rebuildsByContentOwner = new WeakMap<Node, () => void>();

export const scheduleContentRebuild = <T extends Node>(
    node: Node,
    isContentOwner: (candidate: Node) => candidate is T,
    createRebuild: (owner: T) => () => void,
): void => {
    const owner = findClosest(node, isContentOwner);
    if (!owner) return;
    scheduleFlush(getOrInsert(rebuildsByContentOwner, owner, () => createRebuild(owner)));
};
