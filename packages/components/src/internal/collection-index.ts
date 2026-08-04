import type { ListItem, ListSection } from "../types.js";

type Level = {
    key: string;
    parentId: string | null;
    ids: string[];
    expandableFlags: boolean[];
};

type LevelSeed = {
    key: string;
    parentId: string | null;
};

type CollectionIndex = {
    isTree: boolean;
    structureKey: string;
    size: number;
    groups: Level[];
    children: Map<string, Level>;
    parents: Map<string, string>;
    hasId: (id: string) => boolean;
    itemFor: (id: string) => ListItem | undefined;
    sectionFor: (id: string) => unknown;
    positionFor: (id: string) => number;
};

type IndexState = {
    isTree: boolean;
    groups: Level[];
    children: Map<string, Level>;
    parents: Map<string, string>;
    itemsById: Map<string, ListItem>;
    sections: ListSection[] | undefined;
    positions: Map<string, number> | null;
    starts: number[] | null;
};

const ROOT_LEVEL_KEY = "";
const FIELD_SEPARATOR = "\u{0}";
const ID_SEPARATOR = "\u{1}";

const hasChildren = (item: ListItem): boolean => item.children !== undefined && item.children.length > 0;
const childLevelKey = (id: string): string => `child:${id}`;

function collectChildren(state: IndexState, level: Level, item: ListItem): void {
    if (!state.isTree) {
        return;
    }

    const canExpand = hasChildren(item);
    level.expandableFlags.push(canExpand);

    if (!canExpand) {
        return;
    }

    if (level.parentId !== null) {
        state.parents.set(item.id, level.parentId);
    }

    const key = childLevelKey(item.id);
    state.children.set(key, collectLevel(state, { key, parentId: item.id }, item.children ?? []));
}

function collectLevel(state: IndexState, seed: LevelSeed, items: ListItem[]): Level {
    const level: Level = { key: seed.key, parentId: seed.parentId, ids: [], expandableFlags: [] };

    for (const item of items) {
        level.ids.push(item.id);
        state.itemsById.set(item.id, item);
        collectChildren(state, level, item);
    }

    return level;
}

function buildPositions(state: IndexState): void {
    const positions: Map<string, number> = new Map();
    const starts: number[] = [];
    let offset = 0;

    for (const level of state.groups) {
        starts.push(offset);

        for (const id of level.ids) {
            positions.set(id, offset);
            offset += 1;
        }
    }

    state.positions = positions;
    state.starts = starts;
}

function positionFor(state: IndexState, id: string): number {
    if (state.isTree) {
        return -1;
    }

    if (state.positions === null) {
        buildPositions(state);
    }

    return state.positions?.get(id) ?? -1;
}

function sectionAt(starts: number[], position: number): number {
    let low = 0;
    let high = starts.length - 1;

    while (low < high) {
        const middle = Math.ceil((low + high) / 2);

        if ((starts[middle] ?? 0) <= position) {
            low = middle;
        } else {
            high = middle - 1;
        }
    }

    return low;
}

function sectionFor(state: IndexState, id: string): unknown {
    const sections = state.sections;
    const position = positionFor(state, id);

    if (sections === undefined || position < 0 || state.starts === null) {
        return undefined;
    }

    return sections[sectionAt(state.starts, position)]?.value;
}

function buildGroups(state: IndexState, source: ListItem[], sections: ListSection[] | undefined): Level[] {
    if (sections === undefined) {
        return [collectLevel(state, { key: ROOT_LEVEL_KEY, parentId: null }, source)];
    }

    return sections.map((section) => collectLevel(state, { key: section.id, parentId: null }, section.data));
}

function pushLevelKey(parts: string[], level: Level): void {
    parts.push(
        level.key,
        String(level.ids.length),
        level.ids.join(ID_SEPARATOR),
        level.expandableFlags.join(ID_SEPARATOR),
    );
}

function getStructureKey(state: IndexState): string {
    const parts: string[] = [String(state.isTree), String(state.groups.length)];

    for (const level of state.groups) {
        pushLevelKey(parts, level);
    }

    for (const level of state.children.values()) {
        pushLevelKey(parts, level);
    }

    return parts.join(FIELD_SEPARATOR);
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
        parents: new Map(),
        itemsById: new Map(),
        sections,
        positions: null,
        starts: null,
    };

    state.groups = buildGroups(state, source, sections);

    return {
        isTree: state.isTree,
        structureKey: getStructureKey(state),
        size: state.itemsById.size,
        groups: state.groups,
        children: state.children,
        parents: state.parents,
        hasId: (id) => state.itemsById.has(id),
        itemFor: (id) => state.itemsById.get(id),
        sectionFor: (id) => sectionFor(state, id),
        positionFor: (id) => positionFor(state, id),
    };
}

export { createCollectionIndex, childLevelKey, ROOT_LEVEL_KEY, type CollectionIndex, type Level };
