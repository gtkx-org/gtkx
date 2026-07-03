import type { ItemNode } from "../types.js";

export type TreeItemMetadata = {
    hideExpander: boolean;
    indentForDepth: boolean;
    indentForIcon: boolean;
};

type FlattenedRecord<T = unknown> = {
    id: string;
    value: T;
    metadata: TreeItemMetadata;
};

type FlattenResult<T = unknown> = {
    records: FlattenedRecord<T>[];
    idToPosition: Map<string, number>;
    positionToId: Map<number, string>;
};

export type ListStructure = "flat" | "tree";

export const detectStructure = <T>(items: ItemNode<T>[] | undefined): ListStructure => {
    if (items === undefined) return "flat";
    for (const item of items) {
        if (item.children !== undefined && item.children.length > 0) return "tree";
    }
    return "flat";
};

export const structuralSignature = <T>(items: ItemNode<T>[] | undefined): string => {
    if (items === undefined) return "";
    const parts: string[] = [];
    const walk = (list: ItemNode<T>[]): void => {
        parts.push("[");
        for (const item of list) {
            const hidden = item.hideExpander === true;
            parts.push(`${item.id}|${hidden ? 1 : 0}`);
            if (item.children !== undefined && item.children.length > 0) walk(item.children);
        }
        parts.push("]");
    };
    walk(items);
    return parts.join(",");
};

export const countDescendants = <T>(items: ItemNode<T>[]): number => {
    let total = 0;
    for (const item of items) {
        total += 1;
        if (item.children !== undefined && item.children.length > 0) total += countDescendants(item.children);
    }
    return total;
};

export const treeItemMetadata = <T>(item: ItemNode<T>): TreeItemMetadata => ({
    hideExpander: item.hideExpander ?? false,
    indentForDepth: item.indentForDepth ?? true,
    indentForIcon: item.indentForIcon ?? true,
});

const appendRecord = <T>(item: ItemNode<T>, result: FlattenResult<T>, includeChildren: boolean): void => {
    const position = result.records.length;
    result.idToPosition.set(item.id, position);
    result.positionToId.set(position, item.id);
    result.records.push({
        id: item.id,
        value: item.value,
        metadata: treeItemMetadata(item),
    });
    if (includeChildren && item.children !== undefined) {
        for (const child of item.children) appendRecord(child, result, includeChildren);
    }
};

export const flattenListItems = <T>(
    items: ItemNode<T>[] | undefined,
    flattenTreeChildren: boolean,
): FlattenResult<T> => {
    const result: FlattenResult<T> = {
        records: [],
        idToPosition: new Map(),
        positionToId: new Map(),
    };
    if (items === undefined) return result;
    for (const item of items) {
        appendRecord(item, result, flattenTreeChildren);
    }
    return result;
};
