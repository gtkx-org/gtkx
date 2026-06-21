import { scheduleFlush } from "./commit-flush.js";
import { closestInstance, type Node } from "./state.js";

const rebuildsByOwner = new WeakMap<Node, () => void>();

/**
 * Schedules a rebuild for the nearest ancestor (or `node` itself) matching `ownerPredicate`.
 *
 * The rebuild function produced by `createOwnerRebuild` is memoized per owner so each owner
 * keeps a single stable callback, and the scheduling is funneled through the shared commit
 * flush exactly once. When no matching owner exists, nothing is scheduled.
 *
 * @param node - The node from which to walk up to the owning instance.
 * @param ownerPredicate - Predicate identifying the owner node to rebuild.
 * @param createOwnerRebuild - Factory producing the owner's rebuild callback on first schedule.
 */
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
