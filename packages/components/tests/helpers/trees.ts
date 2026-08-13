import type { ListItem } from "@gtkx/components";
import type { ListViewFixture } from "./list-fixtures.js";

type TreeName = { name: string };
type TreeFixture = ListViewFixture<TreeName>;

const treeLeaf = (id: string): ListItem<TreeName> => ({ id, value: { name: id } });

const treeBranch = (id: string, children: ListItem<TreeName>[]): ListItem<TreeName> => ({
    id,
    value: { name: id },
    children,
});

const chainId = (level: number): string => `n${String(level)}`;

const deepChain = (depth: number): ListItem<TreeName>[] => {
    let deepest = treeLeaf(chainId(depth - 1));

    for (let level = depth - 2; level >= 0; level -= 1) {
        deepest = { ...treeLeaf(chainId(level)), children: [deepest] };
    }

    return [deepest];
};

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

export {
    deepChain,
    mutuallyReferentialItems,
    selfReferentialItems,
    treeBranch,
    treeLeaf,
    type TreeFixture,
    type TreeName,
};
