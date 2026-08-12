import type { ListItem, ListSection } from "../types.js";
import { encodePart, scanParts } from "./keys.js";

type Level = {
    path: string;
    items: ListItem[];
    expandableFlags: boolean[];
};

type CollectionIndex = {
    isTree: boolean;
    groups: Level[];
    levelFor: (levelPath: string) => Level | undefined;
    itemAt: (levelPath: string, slot: number) => ListItem | undefined;
    sectionFor: (levelPath: string) => unknown;
    expandablePaths: () => string[];
    expandablePathsFor: (id: string) => string[];
};

type IndexState = {
    isTree: boolean;
    groups: Level[];
    levels: Map<string, Level>;
    paths: Map<string, string[]> | null;
    sectionValues: Map<string, unknown>;
};

type LevelCursor = {
    level: Level | undefined;
    path: string;
};

type PathFrame = {
    path: string;
    items: ListItem[];
    cursor: number;
    owner: ListItem | null;
};

type PathWalk = {
    paths: Map<string, string[]>;
    frames: PathFrame[];
    ancestors: Set<ListItem>;
};

const NO_PATHS: string[] = [];

const hasChildren = (item: ListItem): boolean => item.children !== undefined && item.children.length > 0;

const childItems = (item: ListItem | undefined): ListItem[] | undefined =>
    item !== undefined && hasChildren(item) ? item.children : undefined;

function pushPath(table: Map<string, string[]>, id: string, path: string): void {
    const existing = table.get(id);

    if (existing === undefined) {
        table.set(id, [path]);

        return;
    }

    existing.push(path);
}

function newLevel(state: IndexState, path: string, items: ListItem[]): Level {
    const expandableFlags = state.isTree ? items.map((item) => hasChildren(item)) : [];
    const level: Level = { path, items, expandableFlags };
    state.levels.set(path, level);

    return level;
}

function childLevel(state: IndexState, parent: Level, slot: number, path: string): Level | undefined {
    const cached = state.levels.get(path);

    if (cached !== undefined) {
        return cached;
    }

    const items = childItems(parent.items[slot]);

    if (items === undefined || !state.isTree) {
        return undefined;
    }

    return newLevel(state, path, items);
}

function stepLevel(state: IndexState, cursor: LevelCursor, part: string): LevelCursor {
    const path = cursor.path + encodePart(part);
    const { level } = cursor;

    if (level === undefined) {
        return { level: undefined, path };
    }

    return { level: childLevel(state, level, Number(part), path), path };
}

function levelFor(state: IndexState, levelPath: string): Level | undefined {
    const cached = state.levels.get(levelPath);

    if (cached !== undefined) {
        return cached;
    }

    const [group, ...slots] = scanParts(levelPath).map((entry) => entry.part);

    if (group === undefined) {
        return undefined;
    }

    const root = encodePart(group);
    let cursor: LevelCursor = { level: state.levels.get(root), path: root };

    for (const part of slots) {
        cursor = stepLevel(state, cursor, part);
    }

    return cursor.level;
}

function visitPathSlot(walk: PathWalk, frame: PathFrame, slot: number): void {
    const item = frame.items[slot];
    const items = childItems(item);

    if (item === undefined || items === undefined || walk.ancestors.has(item)) {
        return;
    }

    const path = frame.path + encodePart(String(slot));
    pushPath(walk.paths, item.id, path);
    walk.ancestors.add(item);
    walk.frames.push({ path, items, cursor: 0, owner: item });
}

function leavePathFrame(walk: PathWalk, frame: PathFrame): void {
    walk.frames.pop();

    if (frame.owner !== null) {
        walk.ancestors.delete(frame.owner);
    }
}

function advancePathFrame(walk: PathWalk): void {
    const frame = walk.frames.at(-1);

    if (frame === undefined) {
        return;
    }

    if (frame.cursor >= frame.items.length) {
        leavePathFrame(walk, frame);

        return;
    }

    const slot = frame.cursor;
    frame.cursor += 1;
    visitPathSlot(walk, frame, slot);
}

function buildPaths(state: IndexState): Map<string, string[]> {
    const paths: Map<string, string[]> = new Map();

    if (!state.isTree) {
        return paths;
    }

    const frames: PathFrame[] = state.groups.map((level) => ({
        path: level.path,
        items: level.items,
        cursor: 0,
        owner: null,
    }));

    const walk: PathWalk = { paths, frames: frames.toReversed(), ancestors: new Set() };

    while (walk.frames.length > 0) {
        advancePathFrame(walk);
    }

    return paths;
}

function pathTable(state: IndexState): Map<string, string[]> {
    state.paths ??= buildPaths(state);

    return state.paths;
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
        paths: null,
        sectionValues: new Map(),
    };

    state.groups = buildGroups(state, source, sections);

    return {
        isTree: state.isTree,
        groups: state.groups,
        levelFor: (levelPath) => levelFor(state, levelPath),
        itemAt: (levelPath, slot) => levelFor(state, levelPath)?.items[slot],
        sectionFor: (levelPath) => state.sectionValues.get(levelPath),
        expandablePaths: () => pathTable(state).values().toArray().flat(),
        expandablePathsFor: (id) => pathTable(state).get(id) ?? NO_PATHS,
    };
}

export { createCollectionIndex, type CollectionIndex, type Level };
