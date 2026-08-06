import type { ListItem, ListSection } from "../types.js";
import { encodePart, joinParts } from "./keys.js";

type Level = {
    path: string;
    items: ListItem[];
    expandableFlags: boolean[];
};

type CollectionIndex = {
    isTree: boolean;
    structureKey: string;
    groups: Level[];
    children: Map<string, Level>;
    itemAt: (path: string) => ListItem | undefined;
    sectionFor: (levelPath: string) => unknown;
    expandablePathsFor: (id: string) => string[];
};

type IndexState = {
    isTree: boolean;
    groups: Level[];
    children: Map<string, Level>;
    itemsByPath: Map<string, ListItem>;
    expandablePaths: Map<string, string[]>;
    sectionValues: Map<string, unknown>;
};

const NO_PATHS: string[] = [];

const hasChildren = (item: ListItem): boolean => item.children !== undefined && item.children.length > 0;

function pushPath(table: Map<string, string[]>, id: string, path: string): void {
    const existing = table.get(id);

    if (existing === undefined) {
        table.set(id, [path]);

        return;
    }

    existing.push(path);
}

function collectChildren(state: IndexState, level: Level, slotPath: string, item: ListItem): void {
    if (!state.isTree) {
        return;
    }

    const canExpand = hasChildren(item);
    level.expandableFlags.push(canExpand);

    if (!canExpand) {
        return;
    }

    pushPath(state.expandablePaths, item.id, slotPath);
    state.children.set(slotPath, collectLevel(state, slotPath, item.children ?? []));
}

function collectLevel(state: IndexState, path: string, items: ListItem[]): Level {
    const level: Level = { path, items, expandableFlags: [] };

    for (const [slot, item] of items.entries()) {
        const slotPath = path + encodePart(String(slot));
        state.itemsByPath.set(slotPath, item);
        collectChildren(state, level, slotPath, item);
    }

    return level;
}

function buildGroups(state: IndexState, source: ListItem[], sections: ListSection[] | undefined): Level[] {
    if (sections === undefined) {
        return [collectLevel(state, encodePart("0"), source)];
    }

    return sections.map((section, group) => {
        const path = encodePart(String(group));
        state.sectionValues.set(path, section.value);

        return collectLevel(state, path, section.data);
    });
}

function pushLevelKey(parts: string[], level: Level): void {
    const ids = level.items.map((item) => item.id);
    parts.push(joinParts([level.path, String(level.items.length), joinParts(ids), level.expandableFlags.join(",")]));
}

function getStructureKey(state: IndexState): string {
    const parts: string[] = [joinParts([String(state.isTree), String(state.groups.length)])];

    for (const level of state.groups) {
        pushLevelKey(parts, level);
    }

    for (const level of state.children.values()) {
        pushLevelKey(parts, level);
    }

    return parts.join("");
}

function isTreeSource(source: ListItem[], sections: ListSection[] | undefined, isFlat: boolean): boolean {
    if (sections !== undefined || isFlat) {
        return false;
    }

    return source.some((item) => hasChildren(item));
}

function createCollectionIndex(
    items: ListItem[] | undefined,
    sections: ListSection[] | undefined,
    isFlat: boolean,
): CollectionIndex {
    const source = items ?? [];

    const state: IndexState = {
        isTree: isTreeSource(source, sections, isFlat),
        groups: [],
        children: new Map(),
        itemsByPath: new Map(),
        expandablePaths: new Map(),
        sectionValues: new Map(),
    };

    state.groups = buildGroups(state, source, sections);

    return {
        isTree: state.isTree,
        structureKey: getStructureKey(state),
        groups: state.groups,
        children: state.children,
        itemAt: (path) => state.itemsByPath.get(path),
        sectionFor: (levelPath) => state.sectionValues.get(levelPath),
        expandablePathsFor: (id) => state.expandablePaths.get(id) ?? NO_PATHS,
    };
}

export { createCollectionIndex, type CollectionIndex, type Level };
