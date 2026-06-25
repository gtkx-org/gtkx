import type { ItemNode } from "../types.js";

export interface TreeItemMetadata {
    hideExpander: boolean;
    indentForDepth: boolean;
    indentForIcon: boolean;
}

export interface FlattenedRecord<T = unknown, S = unknown> {
    id: string;
    value: T | S;
    isHeader: boolean;
    metadata: TreeItemMetadata;
}

export interface FlattenResult<T = unknown, S = unknown> {
    records: FlattenedRecord<T, S>[];
    idToPosition: Map<string, number>;
    positionToId: Map<number, string>;
}

export type ListStructure = "flat" | "tree" | "sections";

/**
 * Classify a controlled item list as flat, tree, or sectioned without building a
 * {@link FlattenResult}. A list is sectioned if any top-level item is a section, a
 * tree if any top-level item carries children, and flat otherwise.
 */
export const detectStructure = <T, S>(items: ItemNode<T, S>[] | undefined): ListStructure => {
    if (items === undefined) return "flat";
    let sawTree = false;
    for (const item of items) {
        if (item.section === true) return "sections";
        if (item.children !== undefined && item.children.length > 0) sawTree = true;
    }
    return sawTree ? "tree" : "flat";
};

export const structuralSignature = <T, S>(items: ItemNode<T, S>[] | undefined): string => {
    if (items === undefined) return "";
    const parts: string[] = [];
    const walk = (list: ItemNode<T, S>[]): void => {
        parts.push("[");
        for (const item of list) {
            const hidden = item.section === true ? false : item.hideExpander === true;
            parts.push(`${item.id}|${item.section === true ? 1 : 0}|${hidden ? 1 : 0}`);
            if (item.children !== undefined && item.children.length > 0) walk(item.children);
        }
        parts.push("]");
    };
    walk(items);
    return parts.join(",");
};

export const treeItemMetadata = <T, S>(item: ItemNode<T, S>): TreeItemMetadata => {
    if (item.section === true) {
        return { hideExpander: false, indentForDepth: false, indentForIcon: false };
    }
    return {
        hideExpander: item.hideExpander ?? false,
        indentForDepth: item.indentForDepth ?? true,
        indentForIcon: item.indentForIcon ?? true,
    };
};

const appendRecord = <T, S>(item: ItemNode<T, S>, result: FlattenResult<T, S>, includeChildren: boolean): void => {
    const position = result.records.length;
    result.idToPosition.set(item.id, position);
    result.positionToId.set(position, item.id);
    result.records.push({
        id: item.id,
        value: item.value,
        isHeader: item.section === true,
        metadata: treeItemMetadata(item),
    });
    if (includeChildren && item.children !== undefined) {
        for (const child of item.children) appendRecord(child, result, includeChildren);
    }
};

export const flattenListItems = <T, S>(
    items: ItemNode<T, S>[] | undefined,
    flattenTreeChildren: boolean,
): FlattenResult<T, S> => {
    const result: FlattenResult<T, S> = {
        records: [],
        idToPosition: new Map(),
        positionToId: new Map(),
    };
    if (items === undefined) return result;
    for (const item of items) {
        if (item.section === true) {
            if (item.children !== undefined) {
                for (const child of item.children) appendRecord(child, result, true);
            }
            continue;
        }
        appendRecord(item, result, flattenTreeChildren);
    }
    return result;
};
