import type { ElementBehavior } from "./elements.js";
import type { ElementNode } from "./node.js";

/** The private per-node state for one behavior, built once by its `createContext` hook. */
export const contextFor = (node: ElementNode, behavior: ElementBehavior): unknown => {
    if (!node.contexts.has(behavior)) node.contexts.set(behavior, behavior.createContext?.(node.object));
    return node.contexts.get(behavior);
};
