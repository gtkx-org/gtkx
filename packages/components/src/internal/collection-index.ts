import type { ListItem, ListSection } from "../types.js";
import { joinParts } from "./keys.js";

type NodeRef = {
    id: string;
    key: string;
    levelKey: string;
};

type Level = {
    key: string;
    parentKey: string | null;
    nodes: NodeRef[];
    expandableFlags: boolean[];
};

type LevelSeed = {
    key: string;
    parentKey: string | null;
    section: ListSection | undefined;
};

type CollectionIndex = {
    isTree: boolean;
    structureKey: string;
    groups: Level[];
    children: Map<string, Level>;
    parents: Map<string, string>;
    itemFor: (key: string) => ListItem | undefined;
    sectionFor: (levelKey: string) => unknown;
    expandableKeysFor: (id: string) => string[];
};

type IndexState = {
    isTree: boolean;
    groups: Level[];
    children: Map<string, Level>;
    parents: Map<string, string>;
    itemsByKey: Map<string, ListItem>;
    expandableKeys: Map<string, string[]>;
    sectionValues: Map<string, unknown>;
};

const ROOT_LEVEL_KEY = "";
const NO_KEYS: string[] = [];

const hasChildren = (item: ListItem): boolean => item.children !== undefined && item.children.length > 0;

const nodeKeyFor = (levelKey: string, id: string, ordinal: number): string =>
    `${levelKey}${joinParts([id, String(ordinal)])}`;

function takeOrdinal(ordinals: Map<string, number>, id: string): number {
    const used = ordinals.get(id) ?? 0;
    ordinals.set(id, used + 1);

    return used;
}

function pushKey(table: Map<string, string[]>, id: string, key: string): void {
    const existing = table.get(id);

    if (existing === undefined) {
        table.set(id, [key]);

        return;
    }

    existing.push(key);
}

function collectChildren(state: IndexState, level: Level, node: NodeRef, item: ListItem): void {
    if (!state.isTree) {
        return;
    }

    const canExpand = hasChildren(item);
    level.expandableFlags.push(canExpand);

    if (!canExpand) {
        return;
    }

    if (level.parentKey !== null) {
        state.parents.set(node.key, level.parentKey);
    }

    pushKey(state.expandableKeys, node.id, node.key);
    const seed: LevelSeed = { key: node.key, parentKey: node.key, section: undefined };
    state.children.set(node.key, collectLevel(state, seed, item.children ?? []));
}

function collectLevel(state: IndexState, seed: LevelSeed, items: ListItem[]): Level {
    const level: Level = { key: seed.key, parentKey: seed.parentKey, nodes: [], expandableFlags: [] };
    const ordinals: Map<string, number> = new Map();

    if (seed.section !== undefined) {
        state.sectionValues.set(seed.key, seed.section.value);
    }

    for (const item of items) {
        const key = nodeKeyFor(seed.key, item.id, takeOrdinal(ordinals, item.id));
        const node: NodeRef = { id: item.id, key, levelKey: seed.key };
        level.nodes.push(node);
        state.itemsByKey.set(node.key, item);
        collectChildren(state, level, node, item);
    }

    return level;
}

function buildGroups(state: IndexState, source: ListItem[], sections: ListSection[] | undefined): Level[] {
    if (sections === undefined) {
        return [collectLevel(state, { key: ROOT_LEVEL_KEY, parentKey: null, section: undefined }, source)];
    }

    const ordinals: Map<string, number> = new Map();

    return sections.map((section) => {
        const key = nodeKeyFor(ROOT_LEVEL_KEY, section.id, takeOrdinal(ordinals, section.id));

        return collectLevel(state, { key, parentKey: null, section }, section.data);
    });
}

function pushLevelKey(parts: string[], level: Level): void {
    const ids = level.nodes.map((node) => node.id);
    parts.push(joinParts([level.key, String(level.nodes.length), joinParts(ids), level.expandableFlags.join(",")]));
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
        parents: new Map(),
        itemsByKey: new Map(),
        expandableKeys: new Map(),
        sectionValues: new Map(),
    };

    state.groups = buildGroups(state, source, sections);

    return {
        isTree: state.isTree,
        structureKey: getStructureKey(state),
        groups: state.groups,
        children: state.children,
        parents: state.parents,
        itemFor: (key) => state.itemsByKey.get(key),
        sectionFor: (levelKey) => state.sectionValues.get(levelKey),
        expandableKeysFor: (id) => state.expandableKeys.get(id) ?? NO_KEYS,
    };
}

export { createCollectionIndex, ROOT_LEVEL_KEY, type CollectionIndex, type Level, type NodeRef };
