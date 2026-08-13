import type { ListItem } from "@gtkx/components";
import type { TreeName } from "./tree-fixtures.js";
import { treeLeaf } from "./tree-fixtures.js";

const chainId = (level: number): string => `n${String(level)}`;

const deepChain = (depth: number): ListItem<TreeName>[] => {
    let deepest = treeLeaf(chainId(depth - 1));

    for (let level = depth - 2; level >= 0; level -= 1) {
        deepest = { ...treeLeaf(chainId(level)), children: [deepest] };
    }

    return [deepest];
};

const chainIds = (depth: number): string[] => Array.from({ length: depth }, (_, level) => chainId(level));

const selfReferentialItems = (): ListItem<TreeName>[] => {
    const loop = treeLeaf("loop");
    loop.children = [loop];

    return [loop];
};

const mutuallyReferentialItems = (): ListItem<TreeName>[] => {
    const first = treeLeaf("a");
    const second = treeLeaf("b");
    first.children = [second];
    second.children = [first];

    return [first];
};

export { chainIds, deepChain, mutuallyReferentialItems, selfReferentialItems };
