import type { ListItem, ListSection } from "../types.js";
import { encodePart } from "./keys.js";

type Level = {
    path: string;
    items: ListItem[];
    expandableFlags: boolean[];
};

type CollectionIndex = {
    isTree: boolean;
    groups: Level[];
    children: Map<string, Level>;
    itemAt: (levelPath: string, slot: number) => ListItem | undefined;
    sectionFor: (levelPath: string) => unknown;
    expandablePathsFor: (id: string) => string[];
};

type IndexState = {
    isTree: boolean;
    groups: Level[];
    children: Map<string, Level>;
    levels: Map<string, Level>;
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
    state.levels.set(path, level);

    if (!state.isTree) {
        return level;
    }

    for (const [slot, item] of items.entries()) {
        collectChildren(state, level, path + encodePart(String(slot)), item);
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
        levels: new Map(),
        expandablePaths: new Map(),
        sectionValues: new Map(),
    };

    state.groups = buildGroups(state, source, sections);

    return {
        isTree: state.isTree,
        groups: state.groups,
        children: state.children,
        itemAt: (levelPath, slot) => state.levels.get(levelPath)?.items[slot],
        sectionFor: (levelPath) => state.sectionValues.get(levelPath),
        expandablePathsFor: (id) => state.expandablePaths.get(id) ?? NO_PATHS,
    };
}

export { createCollectionIndex, type CollectionIndex, type Level };
