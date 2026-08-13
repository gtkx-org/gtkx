import type { ListItem, ListSection } from "../types.js";
import { decodePartAt, encodePart } from "./keys.js";

type Level = {
    path: string;
    items: ListItem[];
    expandableFlags: boolean[];
};

type CollectionIndex = {
    isTree: boolean;
    groups: Level[];
    childLevel: (level: Level, slot: number) => Level | undefined;
    levelFor: (levelPath: string) => Level | undefined;
    itemAt: (levelPath: string, slot: number) => ListItem | undefined;
    sectionFor: (levelPath: string) => unknown;
};

type IndexState = {
    isTree: boolean;
    groups: Level[];
    levels: Map<string, Level>;
    sectionValues: Map<string, unknown>;
};

type ParentItem = ListItem & { children: ListItem[] };

const emptyLevel = (): Level => ({ path: "", items: [], expandableFlags: [] });
const hasChildren = (item: ListItem): item is ParentItem => item.children !== undefined && item.children.length > 0;

function newLevel(state: IndexState, path: string, items: ListItem[]): Level {
    const expandableFlags = state.isTree ? items.map((item) => hasChildren(item)) : [];
    const level: Level = { path, items, expandableFlags };
    state.levels.set(path, level);

    return level;
}

function slotItems(state: IndexState, parent: Level, slot: number): ListItem[] | undefined {
    const owner = state.levels.get(parent.path) === parent ? parent : levelFor(state, parent.path);
    const item = owner?.items[slot];

    return item !== undefined && hasChildren(item) ? item.children : undefined;
}

function childLevel(state: IndexState, parent: Level, slot: number): Level | undefined {
    if (!state.isTree) {
        return undefined;
    }

    const path = parent.path + encodePart(String(slot));
    const cached = state.levels.get(path);

    if (cached !== undefined) {
        return cached;
    }

    const items = slotItems(state, parent, slot);

    return items === undefined ? undefined : newLevel(state, path, items);
}

function descendPath(state: IndexState, levelPath: string, group: string): Level | undefined {
    let level = state.levels.get(encodePart(group));
    let offset = encodePart(group).length;

    while (level !== undefined && offset < levelPath.length) {
        const part = decodePartAt(levelPath, offset);

        if (part === null) {
            return undefined;
        }

        level = childLevel(state, level, Number(part));
        offset += encodePart(part).length;
    }

    return level;
}

function levelFor(state: IndexState, levelPath: string): Level | undefined {
    const cached = state.levels.get(levelPath);

    if (cached !== undefined) {
        return cached;
    }

    const group = decodePartAt(levelPath, 0);

    return group === null ? undefined : descendPath(state, levelPath, group);
}

function buildGroups(state: IndexState, source: ListItem[], sections: ListSection[] | undefined): Level[] {
    if (sections === undefined) {
        return [newLevel(state, encodePart("0"), source)];
    }

    return sections.map((section, group) => {
        const path = encodePart(String(group));
        state.sectionValues.set(path, section.value);

        return newLevel(state, path, section.data);
    });
}

function isTreeSource(source: ListItem[], sections: ListSection[] | undefined, isFlat: boolean): boolean {
    if (isFlat) {
        return false;
    }

    if (sections === undefined) {
        return source.some((item) => hasChildren(item));
    }

    return sections.some((section) => section.data.some((item) => hasChildren(item)));
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
        levels: new Map(),
        sectionValues: new Map(),
    };

    state.groups = buildGroups(state, source, sections);

    return {
        isTree: state.isTree,
        groups: state.groups,
        childLevel: (level, slot) => childLevel(state, level, slot),
        levelFor: (levelPath) => levelFor(state, levelPath),
        itemAt: (levelPath, slot) => levelFor(state, levelPath)?.items[slot],
        sectionFor: (levelPath) => state.sectionValues.get(levelPath),
    };
}

export { createCollectionIndex, emptyLevel, type CollectionIndex, type Level };
