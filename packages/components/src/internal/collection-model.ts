import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { CollectionIndex, Level } from "./collection-index.js";
import { childLevelKey, ROOT_LEVEL_KEY } from "./collection-index.js";

type LevelState = {
    store: Gio.ListStore;
    ids: string[];
    canExpand: Map<string, boolean>;
};

type SpliceRange = {
    start: number;
    removed: number;
    added: string[];
};

type ModelState = {
    root: Gio.ListStore;
    rootModels: GObject.Object[];
    model: Gtk.FlattenListModel;
    objects: Map<string, Gtk.StringObject>;
    levels: Map<string, LevelState>;
    tree: Gtk.TreeListModel | null;
};

type CollectionModel = {
    model: Gtk.FlattenListModel;
    treeModel: () => Gtk.TreeListModel | null;
    sync: (index: CollectionIndex) => void;
};

const OBJECT_CACHE_MAX = 1 << 20;

const newStore = (): Gio.ListStore => new Gio.ListStore({ itemType: GObject.TYPE_OBJECT });

function getId(value: GObject.Object | null): string | null {
    const item = value instanceof Gtk.TreeListRow ? value.getItem() : value;

    return item instanceof Gtk.StringObject ? item.getString() : null;
}

function objectFor(state: ModelState, id: string): Gtk.StringObject {
    const existing = state.objects.get(id);

    if (existing !== undefined) {
        return existing;
    }

    const created = Gtk.StringObject.new(id);
    state.objects.set(id, created);

    return created;
}

function commonPrefix(previous: string[], next: string[], max: number): number {
    let count = 0;

    while (count < max && previous[count] === next[count]) {
        count += 1;
    }

    return count;
}

function commonSuffix(previous: string[], next: string[], max: number): number {
    let count = 0;

    while (count < max && previous[previous.length - 1 - count] === next[next.length - 1 - count]) {
        count += 1;
    }

    return count;
}

function spliceRange(previous: string[], next: string[]): SpliceRange | null {
    const shared = Math.min(previous.length, next.length);
    const start = commonPrefix(previous, next, shared);

    if (start === previous.length && start === next.length) {
        return null;
    }

    const tail = commonSuffix(previous, next, shared - start);

    return { start, removed: previous.length - start - tail, added: next.slice(start, next.length - tail) };
}

function levelFor(state: ModelState, key: string): LevelState {
    const existing = state.levels.get(key);

    if (existing !== undefined) {
        return existing;
    }

    const created: LevelState = { store: newStore(), ids: [], canExpand: new Map() };
    state.levels.set(key, created);

    return created;
}

function refreshExpandable(current: LevelState, level: Level): void {
    const next: Map<string, boolean> = new Map();

    for (const [index, id] of level.ids.entries()) {
        const isWanted = level.isExpandable[index] ?? false;
        const previous = current.canExpand.get(id);
        next.set(id, isWanted);

        if (previous !== undefined && previous !== isWanted) {
            current.store.itemsChanged(index, 1, 1);
        }
    }

    current.canExpand = next;
}

function didSpliceLevel(state: ModelState, level: Level): boolean {
    const current = levelFor(state, level.key);
    const range = spliceRange(current.ids, level.ids);

    if (range === null) {
        return false;
    }

    current.store.splice(range.start, range.removed, range.added.map((id) => objectFor(state, id)));
    current.ids = [...level.ids];

    return true;
}

function dropUnvisited(state: ModelState, visited: Set<string>): void {
    for (const key of state.levels.keys()) {
        if (!visited.has(key)) {
            state.levels.delete(key);
        }
    }
}

// Items keep their identity by id, so a collection that shrinks keeps its objects cached: filtering a long
// list down and back up reuses them instead of rebuilding one GObject per row. Incremental filters shrink and
// grow the list many times per keystroke, so the cache is only swept once it passes an absolute bound.
function pruneObjects(state: ModelState, index: CollectionIndex): void {
    if (state.objects.size <= OBJECT_CACHE_MAX) {
        return;
    }

    for (const id of state.objects.keys()) {
        if (!index.has(id)) {
            state.objects.delete(id);
        }
    }
}

function childStoreFor(state: ModelState, object: GObject.Object): Gio.ListStore | null {
    const id = getId(object);

    if (id === null) {
        return null;
    }

    return state.levels.get(childLevelKey(id))?.store ?? null;
}

function ensureTree(state: ModelState): Gtk.TreeListModel {
    state.tree ??= Gtk.TreeListModel.new(levelFor(state, ROOT_LEVEL_KEY).store, false, false, (object) =>
        childStoreFor(state, object));

    return state.tree;
}

function desiredRootModels(state: ModelState, index: CollectionIndex): GObject.Object[] {
    if (index.isTree) {
        return [ensureTree(state)];
    }

    return index.groups.map((level) => levelFor(state, level.key).store);
}

function hasSameModels(previous: GObject.Object[], next: GObject.Object[]): boolean {
    return previous.length === next.length && next.every((model, index) => previous[index] === model);
}

function syncRoot(state: ModelState, index: CollectionIndex): void {
    const next = desiredRootModels(state, index);

    if (hasSameModels(state.rootModels, next)) {
        return;
    }

    state.root.splice(0, state.rootModels.length, next);
    state.rootModels = next;
}

function syncModel(state: ModelState, index: CollectionIndex): void {
    const levels = [...index.groups, ...index.children.values()];
    const visited: Set<string> = new Set();
    let didChange = false;

    for (const level of levels) {
        didChange = didSpliceLevel(state, level) || didChange;
        visited.add(level.key);
    }

    if (didChange || visited.size !== state.levels.size) {
        dropUnvisited(state, visited);
        pruneObjects(state, index);
    }

    syncRoot(state, index);
    refreshExpandableLevels(state, index, levels);
}

function refreshExpandableLevels(state: ModelState, index: CollectionIndex, levels: Level[]): void {
    if (!index.isTree) {
        return;
    }

    for (const level of levels) {
        refreshExpandable(levelFor(state, level.key), level);
    }
}

function createCollectionModel(): CollectionModel {
    const root = newStore();

    const state: ModelState = {
        root,
        rootModels: [],
        model: Gtk.FlattenListModel.new(root),
        objects: new Map(),
        levels: new Map(),
        tree: null,
    };

    return {
        model: state.model,
        treeModel: () => state.tree,
        sync: (index) => {
            syncModel(state, index);
        },
    };
}

export { createCollectionModel, getId, type CollectionModel };
