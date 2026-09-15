import type { ListItem } from "@gtkx/components";

type TreeName = { name: string };

const treeLeaf = (id: string): ListItem<TreeName> => ({ id, value: { name: id } });

const treeBranch = (id: string, children: ListItem<TreeName>[]): ListItem<TreeName> => ({
    id,
    value: { name: id },
    children,
});

export { treeBranch, treeLeaf, type TreeName };
