import { scheduleFlush } from "./commit-flush.js";
import { closestInstance, type Node } from "./state.js";

const rebuildsByHost = new WeakMap<Node, () => void>();

export const scheduleHostRebuild = (
    node: Node,
    hostPredicate: (candidate: Node) => boolean,
    createHostRebuild: (host: Node) => () => void,
): void => {
    const host = closestInstance(node, hostPredicate);
    if (!host) return;
    let rebuild = rebuildsByHost.get(host);
    if (!rebuild) {
        rebuild = createHostRebuild(host);
        rebuildsByHost.set(host, rebuild);
    }
    scheduleFlush(rebuild);
};
