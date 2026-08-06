import type { ListItem } from "@gtkx/components";

const collectExpandableIds = <T>(nodes: ListItem<T>[]): string[] => {
    const ids: string[] = [];

    for (const node of nodes) {
        if (node.children && node.children.length > 0) {
            ids.push(node.id, ...collectExpandableIds(node.children));
        }
    }

    return ids;
};

export { collectExpandableIds };
