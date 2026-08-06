import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import type { CollectionIndex, Level, NodeRef } from "./collection-index.js";
import type { TreeExpansion } from "./tree-expansion.js";
import { createCollectionIndex, ROOT_LEVEL_KEY } from "./collection-index.js";
import { splicePlan } from "./splice-plan.js";
import { adoptIndex, createTreeExpansion, resetExpansion } from "./tree-expansion.js";

type LevelStore = Gio.ListModel & LazyLevelStore;

type LevelState = {
    store: LevelStore;
    canExpand: Map<string, boolean>;
};

type SyncPass = {
    levels: Level[];
    rebuilt: Set<string>;
};

type ModelState = {
    root: Gio.ListStore;
    rootModels: GObject.Object[];
    model: Gtk.FlattenListModel;
    levels: Map<string, LevelState>;
    tree: Gtk.TreeListModel | null;
    expansion: TreeExpansion;
};

type CollectionModel = {
    model: Gtk.FlattenListModel;
    expansion: TreeExpansion;
    treeModel: () => Gtk.TreeListModel | null;
    sync: (index: CollectionIndex) => void;
};

const RESIDENT_OBJECT_MAX = 8192;
const STORE_CLASS_KEY = Symbol.for("gtkx.components.lazy-level-store");
const NODES_KEY = Symbol.for("gtkx.components.lazy-level-store.nodes");
const EMPTY_INDEX = createCollectionIndex(undefined, undefined, true);
const NODES = sharedNodes();

const newRootStore = (): Gio.ListStore => new Gio.ListStore({ itemType: GObject.TYPE_OBJECT });

function sharedNodes(): WeakMap<GObject.Object, NodeRef> {
    const cached: unknown = Reflect.get(globalThis, NODES_KEY);

    if (cached instanceof WeakMap) {
        return cached as WeakMap<GObject.Object, NodeRef>;
    }

    const created: WeakMap<GObject.Object, NodeRef> = new WeakMap();
    Reflect.set(globalThis, NODES_KEY, created);

    return created;
}

function registeredStoreClass(): typeof LazyLevelStore {
    const cached: unknown = Reflect.get(globalThis, STORE_CLASS_KEY);

    if (typeof cached === "function") {
        return cached as typeof LazyLevelStore;
    }

    registerClass(LazyLevelStore, { typeName: "GtkxLazyLevelStore", implements: [Gio.ListModel] });
    Reflect.set(globalThis, STORE_CLASS_KEY, LazyLevelStore);

    return LazyLevelStore;
}

function nodeRefFor(value: GObject.Object | null): NodeRef | null {
    const item = value instanceof Gtk.TreeListRow ? value.getItem() : value;

    if (item === null) {
        return null;
    }

    return NODES.get(item) ?? null;
}

function levelFor(state: ModelState, key: string): LevelState {
    const existing = state.levels.get(key);

    if (existing !== undefined) {
        return existing;
    }

    const created: LevelState = { store: new (registeredStoreClass())() as LevelStore, canExpand: new Map() };
    state.levels.set(key, created);

    return created;
}

function markRebuilt(rebuilt: Set<string>, nodes: NodeRef[]): void {
    for (const node of nodes) {
        rebuilt.add(node.key);
    }
}

function refreshExpandable(current: LevelState, level: Level, rebuilt: Set<string>): void {
    const next: Map<string, boolean> = new Map();

    for (const [index, node] of level.nodes.entries()) {
        const isWanted = level.expandableFlags[index] ?? false;
        const previous = current.canExpand.get(node.key);
        next.set(node.key, isWanted);

        if (previous !== undefined && previous !== isWanted) {
            current.store.itemsChanged(index, 1, 1);
            rebuilt.add(node.key);
        }
    }

    current.canExpand = next;
}

function spliceLevel(state: ModelState, level: Level, rebuilt: Set<string>): void {
    const current = levelFor(state, level.key);
    const plan = splicePlan(current.store.nodes, [...level.nodes], state.expansion.expanded);

    if (plan === null) {
        return;
    }

    markRebuilt(rebuilt, plan.rebuilt);

    for (const step of plan.steps) {
        current.store.replaceNodes(step.nodes, step.start, step.removed, step.added);
    }
}

function dropUnvisited(state: ModelState, visited: Set<string>): void {
    for (const key of state.levels.keys()) {
        if (!visited.has(key)) {
            state.levels.delete(key);
        }
    }
}

function childStoreFor(state: ModelState, object: GObject.Object): Gio.ListModel | null {
    const node = nodeRefFor(object);

    if (node === null) {
        return null;
    }

    return state.levels.get(node.key)?.store ?? null;
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
    resetExpansion(state.expansion);
}

function refreshExpandableLevels(state: ModelState, index: CollectionIndex, sync: SyncPass): void {
    if (!index.isTree) {
        return;
    }

    for (const level of sync.levels) {
        refreshExpandable(levelFor(state, level.key), level, sync.rebuilt);
    }
}

function spliceLevels(state: ModelState, sync: SyncPass): void {
    const visited: Set<string> = new Set();

    for (const level of sync.levels) {
        spliceLevel(state, level, sync.rebuilt);
        visited.add(level.key);
    }

    if (visited.size !== state.levels.size) {
        dropUnvisited(state, visited);
    }
}

function syncModel(state: ModelState, index: CollectionIndex): void {
    const sync: SyncPass = { levels: [...index.groups, ...index.children.values()], rebuilt: new Set() };
    state.expansion.isSyncing = true;

    try {
        spliceLevels(state, sync);
        syncRoot(state, index);
        refreshExpandableLevels(state, index, sync);
    } finally {
        state.expansion.isSyncing = false;
    }

    adoptIndex(state.expansion, index, sync.rebuilt);
}

function createCollectionModel(): CollectionModel {
    registeredStoreClass();
    const root = newRootStore();

    const state: ModelState = {
        root,
        rootModels: [],
        model: Gtk.FlattenListModel.new(root),
        levels: new Map(),
        tree: null,
        expansion: createTreeExpansion(EMPTY_INDEX),
    };

    return {
        model: state.model,
        expansion: state.expansion,
        treeModel: () => state.tree,
        sync: (index) => {
            syncModel(state, index);
        },
    };
}

class LazyLevelStore extends GObject.Object implements Gio.ListModelImpl {
    private hasEvictableObjects = true;
    declare itemsChanged: Gio.ListModel["itemsChanged"];
    nodes: NodeRef[] = [];
    objects: Map<string, Gtk.StringObject> = new Map();

    private evictOverflow(): void {
        if (this.objects.size <= RESIDENT_OBJECT_MAX || !this.hasEvictableObjects) {
            return;
        }

        const live: Set<string> = new Set(this.nodes.map((node) => node.key));

        for (const key of this.objects.keys()) {
            if (!live.has(key)) {
                this.objects.delete(key);
            }
        }

        this.hasEvictableObjects = false;
    }

    private mint(node: NodeRef): Gtk.StringObject {
        const created = Gtk.StringObject.new(node.id);
        this.objects.set(node.key, created);
        NODES.set(created, node);
        this.evictOverflow();

        return created;
    }

    vfuncGetItemType(): bigint {
        return GObject.TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return this.nodes.length;
    }

    vfuncGetItem(position: number): GObject.Object | null {
        const node = this.nodes[position];

        if (node === undefined) {
            return null;
        }

        return this.objects.get(node.key) ?? this.mint(node);
    }

    replaceNodes(next: NodeRef[], start: number, removed: number, added: number): void {
        this.nodes = next;
        this.hasEvictableObjects = true;
        this.itemsChanged(start, removed, added);
    }
}

export { createCollectionModel, nodeRefFor, type CollectionModel };
