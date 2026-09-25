import type { ReactNode, Ref } from "react";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { createElementComponent } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import type { CollectionIndex, Level } from "./collection-index.js";
import type { TreeExpansion } from "./tree-expansion.js";
import { createCollectionIndex } from "./collection-index.js";
import { encodePart } from "./keys.js";
import { adoptIndex, createTreeExpansion, pruneSlots } from "./tree-expansion.js";

type LevelStore = Gio.ListModel & LazyLevelStore;

type SlotRef = {
    store: LazyLevelStore;
    slot: number;
};

type SyncContext = {
    index: CollectionIndex;
    expansion: TreeExpansion;
};

type SlotRun = {
    start: number;
    length: number;
};

type ModelState = {
    root: CollectionRootStore | null;
    model: Gtk.FlattenListModel | null;
    groupStores: Map<number, LevelStore>;
    trees: Map<LevelStore, Gtk.TreeListModel>;
    expansion: TreeExpansion;
    index: CollectionIndex;
};

type CollectionModel = {
    expansion: TreeExpansion;
    rowAt: (position: number) => Gtk.TreeListRow | null;
    bind: (root: CollectionRootStore, model: Gtk.FlattenListModel) => void;
    clear: () => void;
    sync: (index: CollectionIndex) => void;
};

type CollectionRootProps = { ref: Ref<CollectionRootStore> };

const STORE_CLASS_KEY = Symbol.for("gtkx.components.lazy-level-store");
const ROOT_CLASS_KEY = Symbol.for("gtkx.components.collection-root-store");
const SLOTS_KEY = Symbol.for("gtkx.components.lazy-level-store.slots");
const EMPTY_INDEX = createCollectionIndex(undefined, [], true);

function sharedSlots(): WeakMap<GObject.Object, SlotRef> {
    const cached: unknown = Reflect.get(globalThis, SLOTS_KEY);

    if (cached instanceof WeakMap) {
        return cached as WeakMap<GObject.Object, SlotRef>;
    }

    const created: WeakMap<GObject.Object, SlotRef> = new WeakMap();
    Reflect.set(globalThis, SLOTS_KEY, created);

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

function registeredRootClass(): unknown {
    const cached: unknown = Reflect.get(globalThis, ROOT_CLASS_KEY);

    if (typeof cached === "function") {
        return cached;
    }

    registerClass(CollectionRootStore, { typeName: "GtkxCollectionRootStore", implements: [Gio.ListModel] });
    Reflect.set(globalThis, ROOT_CLASS_KEY, CollectionRootStore);

    return CollectionRootStore;
}

function slotRefFor(value: GObject.Object | null): SlotRef | null {
    const item = value instanceof Gtk.TreeListRow ? value.getItem() : value;

    if (item === null) {
        return null;
    }

    const ref = sharedSlots().get(item);

    return ref === undefined || ref.slot === -1 ? null : ref;
}

function slotPathAt(store: LazyLevelStore, slot: number): string {
    return store.level.path + encodePart(String(slot));
}

function newLevelStore(level: Level): LevelStore {
    const store = new (registeredStoreClass())() as LevelStore;
    store.level = level;

    return store;
}

function collectFlips(previous: Level, next: Level, overlap: number): Set<number> {
    const flipped: Set<number> = new Set();

    if (previous.expandableFlags.length === 0 && next.expandableFlags.length === 0) {
        return flipped;
    }

    for (let slot = 0; slot < overlap; slot++) {
        if ((previous.expandableFlags[slot] ?? false) !== (next.expandableFlags[slot] ?? false)) {
            flipped.add(slot);
        }
    }

    return flipped;
}

function pruneFlips(context: SyncContext, store: LevelStore, flipped: Set<number>): void {
    if (flipped.size === 0) {
        return;
    }

    pruneSlots(context.expansion, store.level.path, (slot) => flipped.has(slot));

    for (const slot of flipped) {
        store.childStores.delete(slot);
    }
}

function detachRefs(store: LevelStore, nextLength: number): void {
    for (const [slot, ref] of store.refs) {
        if (slot < nextLength) {
            continue;
        }

        ref.slot = -1;
        store.refs.delete(slot);
        store.objects.delete(slot);
        store.childStores.delete(slot);
    }
}

function shrinkStore(context: SyncContext, store: LevelStore, previousLength: number, nextLength: number): void {
    if (previousLength <= nextLength) {
        return;
    }

    detachRefs(store, nextLength);
    pruneSlots(context.expansion, store.level.path, (slot) => slot >= nextLength);
}

function emitTailSplice(store: LevelStore, previousLength: number, nextLength: number): void {
    if (nextLength < previousLength) {
        store.itemsChanged(nextLength, previousLength - nextLength, 0);

        return;
    }

    if (nextLength > previousLength) {
        store.itemsChanged(previousLength, 0, nextLength - previousLength);
    }
}

function extendRuns(runs: SlotRun[], slot: number): void {
    const last = runs.at(-1);

    if (last !== undefined && last.start + last.length === slot) {
        last.length += 1;

        return;
    }

    runs.push({ start: slot, length: 1 });
}

function collectFlipRuns(flipped: Set<number>): SlotRun[] {
    const runs: SlotRun[] = [];

    for (const slot of flipped) {
        extendRuns(runs, slot);
    }

    return runs;
}

function emitFlips(store: LevelStore, flipped: Set<number>): void {
    for (const run of collectFlipRuns(flipped)) {
        store.itemsChanged(run.start, run.length, run.length);
    }
}

function syncLevel(context: SyncContext, store: LevelStore, level: Level): void {
    const previous = store.level;
    const previousLength = previous.items.length;
    const overlap = Math.min(previousLength, level.items.length);
    const flipped = collectFlips(previous, level, overlap);
    store.level = level;
    pruneFlips(context, store, flipped);
    shrinkStore(context, store, previousLength, level.items.length);
    emitTailSplice(store, previousLength, level.items.length);
    emitFlips(store, flipped);

    for (const [slot, child] of store.childStores) {
        if (slot >= overlap || flipped.has(slot)) {
            continue;
        }

        const childLevel = context.index.childLevel(level, slot);

        if (childLevel !== undefined) {
            syncLevel(context, child, childLevel);
        }
    }
}

function ensureChildStore(index: CollectionIndex, store: LazyLevelStore, slot: number): LevelStore | null {
    const existing = store.childStores.get(slot) ?? null;

    if (existing !== null || !(store.level.expandableFlags[slot] ?? false)) {
        return existing;
    }

    const level = index.childLevel(store.level, slot);

    if (level === undefined) {
        return null;
    }

    const created = newLevelStore(level);
    store.childStores.set(slot, created);

    return created;
}

function childStoreFor(state: ModelState, object: GObject.Object): Gio.ListModel | null {
    const ref = slotRefFor(object);

    if (ref === null) {
        return null;
    }

    return ensureChildStore(state.index, ref.store, ref.slot);
}

function treeFor(state: ModelState, store: LevelStore): Gtk.TreeListModel {
    const existing = state.trees.get(store);

    if (existing !== undefined) {
        return existing;
    }

    const created = Gtk.TreeListModel.new(store, false, false, (object) => childStoreFor(state, object));
    state.trees.set(store, created);

    return created;
}

function rowAt(state: ModelState, position: number): Gtk.TreeListRow | null {
    const item = state.model?.getItem(position);

    return item instanceof Gtk.TreeListRow ? item : null;
}

function pruneGroups(state: ModelState, previous: CollectionIndex): void {
    const hasModeChanged = previous.isTree !== state.index.isTree;

    for (const [group, store] of state.groupStores) {
        const isRemoved = group >= state.index.groups.length;

        if (isRemoved || hasModeChanged) {
            pruneSlots(state.expansion, store.level.path, () => true);
            state.trees.delete(store);
        }

        if (isRemoved) {
            state.groupStores.delete(group);
        }
    }
}

function syncRoot(state: ModelState, previous: CollectionIndex): void {
    const before = previous.groups.length;
    const after = state.index.groups.length;

    if (previous.isTree !== state.index.isTree) {
        state.root?.itemsChanged(0, before, after);

        return;
    }

    if (before !== after) {
        const start = Math.min(before, after);
        state.root?.itemsChanged(start, before - start, after - start);
    }
}

function stepGroupStores(state: ModelState, context: SyncContext): void {
    for (const [group, store] of state.groupStores) {
        const level = context.index.groups[group];

        if (level !== undefined && store.level !== level) {
            syncLevel(context, store, level);
        }
    }
}

function syncModel(state: ModelState, index: CollectionIndex): void {
    if (state.root === null) {
        return;
    }

    const context: SyncContext = { index, expansion: state.expansion };
    const previous = state.index;
    state.index = index;
    state.expansion.isSyncing = true;

    try {
        pruneGroups(state, previous);
        syncRoot(state, previous);
        stepGroupStores(state, context);
    } finally {
        state.expansion.isSyncing = false;
    }

    adoptIndex(state.expansion, index);
}

function clearModel(state: ModelState): void {
    const root = state.root;
    const previousLength = state.index.groups.length;
    state.expansion.isSyncing = true;

    try {
        if (root !== null) {
            root.state = null;
        }

        state.root = null;
        state.model = null;
        state.index = EMPTY_INDEX;
        state.groupStores.clear();
        state.trees.clear();
        state.expansion.expanded.clear();
        state.expansion.slots.clear();
        adoptIndex(state.expansion, EMPTY_INDEX);

        if (previousLength > 0) {
            root?.itemsChanged(0, previousLength, 0);
        }
    } finally {
        state.expansion.isSyncing = false;
    }
}

function createCollectionModel(): CollectionModel {
    const state: ModelState = {
        root: null,
        model: null,
        groupStores: new Map(),
        trees: new Map(),
        expansion: createTreeExpansion(EMPTY_INDEX),
        index: EMPTY_INDEX,
    };

    return {
        expansion: state.expansion,
        rowAt: (position) => rowAt(state, position),
        bind: (root, model) => {
            root.state = state;
            state.root = root;
            state.model = model;
        },
        clear: () => {
            clearModel(state);
        },
        sync: (index) => {
            syncModel(state, index);
        },
    };
}

class CollectionRootStore extends GObject.Object implements Gio.ListModelImpl {
    declare itemsChanged: Gio.ListModel["itemsChanged"];
    state: ModelState | null = null;

    vfuncGetItemType(): bigint {
        return GObject.TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return this.state?.index.groups.length ?? 0;
    }

    vfuncGetItem(position: number): GObject.Object | null {
        const state = this.state;
        const level = state?.index.groups[position];

        if (state === null || level === undefined) {
            return null;
        }

        let store = state.groupStores.get(position);

        if (store === undefined) {
            store = newLevelStore(level);
            state.groupStores.set(position, store);
        }

        return state.index.isTree ? treeFor(state, store) : store;
    }
}

class LazyLevelStore extends GObject.Object implements Gio.ListModelImpl {
    declare itemsChanged: Gio.ListModel["itemsChanged"];
    level: Level = { path: "", items: [], expandableFlags: [] };
    refs: Map<number, SlotRef> = new Map();
    objects: Map<number, Gtk.StringObject> = new Map();
    childStores: Map<number, LevelStore> = new Map();

    private createItem(position: number): Gtk.StringObject {
        const ref = { store: this, slot: position };
        const created = Gtk.StringObject.new("");
        this.refs.set(position, ref);
        this.objects.set(position, created);
        sharedSlots().set(created, ref);

        return created;
    }

    vfuncGetItemType(): bigint {
        return GObject.TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return this.level.items.length;
    }

    vfuncGetItem(position: number): GObject.Object | null {
        if (position < 0 || position >= this.level.items.length) {
            return null;
        }

        return this.objects.get(position) ?? this.createItem(position);
    }
}

const CollectionRoot: (props: CollectionRootProps) => ReactNode = createElementComponent<CollectionRootProps>(
    "GtkxCollectionRootStore",
    registeredRootClass(),
);

export {
    CollectionRoot,
    createCollectionModel,
    slotPathAt,
    slotRefFor,
    type CollectionModel,
    type CollectionRootStore,
    type SlotRef,
};
