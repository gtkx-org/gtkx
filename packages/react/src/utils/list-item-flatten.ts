import type { ListItem } from "./element-props.js";

/**
 * Per-item metadata controlling how a tree row's `Gtk.TreeExpander` is configured.
 */
export interface TreeItemMetadata {
    hideExpander: boolean;
    indentForDepth: boolean;
    indentForIcon: boolean;
}

/**
 * A single flattened record produced from a `ListItem` tree.
 *
 * Records are emitted in depth-first declaration order: a parent precedes its children, and
 * siblings keep their array order. Each record carries the resolved value, the originating id,
 * whether it is a section header, whether it has children (and is therefore expandable), and the
 * tree-expander metadata to apply when the row realizes.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface FlattenedRecord<T = unknown, S = unknown> {
    id: string;
    value: T | S;
    isHeader: boolean;
    hasChildren: boolean;
    children: ListItem<T, S>[];
    metadata: TreeItemMetadata;
}

/**
 * The complete flattening of a `ListItem` array into ordered records plus id/position lookups.
 *
 * `records` is the depth-first declaration-ordered list. `idToPosition` and `positionToId` map
 * between an item id and its index within `records`. `isTree` is true when any item declares
 * non-section children; `isSectioned` is true when any top-level item is a section.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface FlattenResult<T = unknown, S = unknown> {
    records: FlattenedRecord<T, S>[];
    idToPosition: Map<string, number>;
    positionToId: Map<number, string>;
    isTree: boolean;
    isSectioned: boolean;
}

/**
 * Computes a structural signature for a `ListItem` array.
 *
 * The signature captures only what the GTK position-only model depends on: the ordered ids, the
 * section flags, the expander-visibility flag, and the nested children shape. Two arrays with the
 * same signature produce an identical GTK model structure, so the model can be reused in place and
 * only the React-side values re-tagged, preserving the widget's scroll and expansion state.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param items - The declaration-ordered list to summarize, or `undefined`.
 * @returns A string uniquely identifying the structural shape.
 */
export const structuralSignature = <T, S>(items: ListItem<T, S>[] | undefined): string => {
    if (items === undefined) return "";
    const parts: string[] = [];
    const walk = (list: ListItem<T, S>[]): void => {
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

/**
 * Derives the tree-expander metadata for a single `ListItem`.
 *
 * Section headers carry no indentation and never an expander; regular items default to indenting
 * for both depth and icon and to showing the expander unless `hideExpander` is set.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param item - The item whose expander metadata to compute.
 * @returns The metadata applied to the realized row's `Gtk.TreeExpander`.
 */
export const treeItemMetadata = <T, S>(item: ListItem<T, S>): TreeItemMetadata => {
    if (item.section === true) {
        return { hideExpander: false, indentForDepth: false, indentForIcon: false };
    }
    return {
        hideExpander: item.hideExpander ?? false,
        indentForDepth: item.indentForDepth ?? true,
        indentForIcon: item.indentForIcon ?? true,
    };
};

const hasChildren = <T, S>(item: ListItem<T, S>): boolean => item.children !== undefined && item.children.length > 0;

const appendRecord = <T, S>(item: ListItem<T, S>, result: FlattenResult<T, S>, includeChildren: boolean): void => {
    const position = result.records.length;
    result.idToPosition.set(item.id, position);
    result.positionToId.set(position, item.id);
    result.records.push({
        id: item.id,
        value: item.value,
        isHeader: item.section === true,
        hasChildren: hasChildren(item),
        children: item.children ?? [],
        metadata: treeItemMetadata(item),
    });
    if (includeChildren && item.children !== undefined) {
        for (const child of item.children) appendRecord(child, result, includeChildren);
    }
};

/**
 * Flattens a `ListItem` array into depth-first ordered records with id/position lookups.
 *
 * Section items are flagged as headers and their children are always inlined after the header.
 * Regular items with children are treated as tree nodes; their children are inlined only when
 * `flattenTreeChildren` is true (used when the tree is auto-expanded), otherwise only the root
 * level is emitted and children resolve lazily as positions are realized.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param items - The declaration-ordered list to flatten, or `undefined` for an empty result.
 * @param flattenTreeChildren - Whether to inline non-section children into the records.
 * @returns The ordered records plus id/position maps and the detected structure flags.
 */
export const flattenListItems = <T, S>(
    items: ListItem<T, S>[] | undefined,
    flattenTreeChildren: boolean,
): FlattenResult<T, S> => {
    const result: FlattenResult<T, S> = {
        records: [],
        idToPosition: new Map(),
        positionToId: new Map(),
        isTree: false,
        isSectioned: false,
    };
    if (items === undefined) return result;
    for (const item of items) {
        if (item.section === true) {
            result.isSectioned = true;
            appendRecord(item, result, true);
            continue;
        }
        if (hasChildren(item)) result.isTree = true;
        appendRecord(item, result, flattenTreeChildren);
    }
    return result;
};
