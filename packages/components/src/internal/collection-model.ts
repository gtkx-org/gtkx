import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import type { CollectionIndex, Level } from "./collection-index.js";
import type { TreeExpansion } from "./tree-expansion.js";
import { createCollectionIndex } from "./collection-index.js";
import { encodePart } from "./keys.js";
import { adoptIndex, createTreeExpansion, pruneSlots } from "./tree-expansion.js";

type LevelStore = Gio.ListModel & LazyLevelStore;

type SlotRef = {
    store: LevelStore;
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

type LevelSync = {
    store: LevelStore;
    level: Level;
};

type ModelState = {
    root: Gio.ListStore;
    rootModels: GObject.Object[];
    model: Gtk.FlattenListModel;
    groupStores: LevelStore[];
    trees: Map<LevelStore, Gtk.TreeListModel>;
    treeModels: Gtk.TreeListModel[];
    expansion: TreeExpansion;
    index: CollectionIndex;
};

type CollectionModel = {
    model: Gtk.FlattenListModel;
    expansion: TreeExpansion;
    rowAt: (position: number) => Gtk.TreeListRow | null;
    sync: (index: CollectionIndex) => void;
};

const STORE_CLASS_KEY = Symbol.for("gtkx.components.lazy-level-store");
const SLOTS_KEY = Symbol.for("gtkx.components.lazy-level-store.slots");
const EMPTY_INDEX = createCollectionIndex(undefined, undefined, true);
const SLOTS = sharedSlots();

const newRootStore = (): Gio.ListStore => new Gio.ListStore({ itemType: GObject.TYPE_OBJECT });

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

function slotRefFor(value: GObject.Object | null): SlotRef | null {
    const item = value instanceof Gtk.TreeListRow ? value.getItem() : value;

    if (item === null) {
        return null;
    }

    const ref = SLOTS.get(item);

    return ref === undefined || ref.slot === -1 ? null : ref;
}

function slotPathAt(store: LevelStore, slot: number): string {
    return store.level.path + encodePart(String(slot));
}

function growStore(store: LevelStore): void {
    for (let slot = store.refs.length; slot < store.level.items.length; slot++) {
        store.refs.push({ store, slot });
        store.objects.push(null);
        store.childStores.push(null);
    }
}

function newLevelStore(level: Level): LevelStore {
    const store = new (registeredStoreClass())() as LevelStore;
    store.level = level;
    growStore(store);

    return store;
}

function collectFlips(previous: Level, next: Level, overlap: number): Set<number> {
    const flipped: Set<number> = new Set();

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
        store.childStores[slot] = null;
    }
}

function detachRefs(store: LevelStore, nextLength: number): void {
    for (let slot = nextLength; slot < store.refs.length; slot++) {
        const ref = store.refs[slot];

        if (ref !== undefined) {
            ref.slot = -1;
        }
    }
}

function shrinkStore(context: SyncContext, store: LevelStore, nextLength: number): void {
    if (store.refs.length <= nextLength) {
        return;
    }

    detachRefs(store, nextLength);
    pruneSlots(context.expansion, store.level.path, (slot) => slot >= nextLength);
    store.refs.length = nextLength;
    store.objects.length = nextLength;
    store.childStores.length = nextLength;
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

function childSync(
    context: SyncContext,
    store: LevelStore,
    slot: number,
    flipped: Set<number>,
): LevelSync | undefined {
    const child = store.childStores[slot] ?? null;

    if (child === null || flipped.has(slot)) {
        return undefined;
    }

    const level = context.index.childLevel(store.level, slot);

    return level === undefined ? undefined : { store: child, level };
}

function childSyncs(context: SyncContext, store: LevelStore, overlap: number, flipped: Set<number>): LevelSync[] {
    const syncs: LevelSync[] = [];

    for (let slot = 0; slot < overlap; slot++) {
        const sync = childSync(context, store, slot, flipped);

        if (sync !== undefined) {
            syncs.push(sync);
        }
    }

    return syncs;
}

function syncEntry(context: SyncContext, entry: LevelSync): LevelSync[] {
    const { store, level } = entry;
    const previousLength = store.refs.length;
    const overlap = Math.min(previousLength, level.items.length);
    const flipped = collectFlips(store.level, level, overlap);
    store.level = level;
    pruneFlips(context, store, flipped);
    shrinkStore(context, store, level.items.length);
    growStore(store);
    emitTailSplice(store, previousLength, level.items.length);
    emitFlips(store, flipped);

    return childSyncs(context, store, overlap, flipped);
}

function syncLevel(context: SyncContext, store: LevelStore, level: Level): void {
    const pending: LevelSync[] = [{ store, level }];

    while (pending.length > 0) {
        const entry = pending.pop();

        if (entry !== undefined) {
            pending.push(...syncEntry(context, entry).toReversed());
        }
    }
}

function ensureChildStore(index: CollectionIndex, store: LevelStore, slot: number): LevelStore | null {
    const existing = store.childStores[slot] ?? null;

    if (existing !== null || !(store.level.expandableFlags[slot] ?? false)) {
        return existing;
    }

    const level = index.childLevel(store.level, slot);

    if (level === undefined) {
        return null;
    }

    const created = newLevelStore(level);
    store.childStores[slot] = created;

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
    return (
        state.trees.get(store) ?? Gtk.TreeListModel.new(store, false, false, (object) => childStoreFor(state, object))
    );
}

function nextTrees(state: ModelState, index: CollectionIndex): Map<LevelStore, Gtk.TreeListModel> {
    if (!index.isTree) {
        return new Map();
    }

    return new Map(state.groupStores.map((store) => [store, treeFor(state, store)]));
}

function pruneRebuiltLevels(state: ModelState, next: Map<LevelStore, Gtk.TreeListModel>): void {
    const stores: Set<LevelStore> = new Set([...state.trees.keys(), ...next.keys()]);

    for (const store of stores) {
        if (state.trees.get(store) !== next.get(store)) {
            pruneSlots(state.expansion, store.level.path, () => true);
        }
    }
}

function adoptTrees(state: ModelState, index: CollectionIndex): void {
    const next = nextTrees(state, index);
    pruneRebuiltLevels(state, next);
    state.trees = next;
    state.treeModels = next.values().toArray();
}

function desiredRootModels(state: ModelState, index: CollectionIndex): GObject.Object[] {
    adoptTrees(state, index);

    return index.isTree ? [...state.treeModels] : [...state.groupStores];
}

function rowAt(state: ModelState, position: number): Gtk.TreeListRow | null {
    let offset = position;

    for (const tree of state.treeModels) {
        const count = tree.getNItems();

        if (offset < count) {
            return tree.getRow(offset);
        }

        offset -= count;
    }

    return null;
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

function adjustGroupStores(state: ModelState, context: SyncContext): void {
    const { groups } = context.index;
    state.groupStores.length = Math.min(state.groupStores.length, groups.length);

    for (const level of groups.slice(state.groupStores.length)) {
        state.groupStores.push(newLevelStore(level));
    }
}

function stepGroupStores(state: ModelState, context: SyncContext, surviving: number): void {
    for (const [group, level] of context.index.groups.entries()) {
        const store = state.groupStores[group];

        if (store !== undefined && group < surviving) {
            syncLevel(context, store, level);
        }
    }
}

function syncModel(state: ModelState, index: CollectionIndex): void {
    const context: SyncContext = { index, expansion: state.expansion };
    const surviving = Math.min(state.groupStores.length, index.groups.length);
    state.index = index;
    state.expansion.isSyncing = true;

    try {
        adjustGroupStores(state, context);
        syncRoot(state, index);
        stepGroupStores(state, context, surviving);
    } finally {
        state.expansion.isSyncing = false;
    }

    adoptIndex(state.expansion, index);
}

function createCollectionModel(): CollectionModel {
    registeredStoreClass();
    const root = newRootStore();

    const state: ModelState = {
        root,
        rootModels: [],
        model: Gtk.FlattenListModel.new(root),
        groupStores: [],
        trees: new Map(),
        treeModels: [],
        expansion: createTreeExpansion(EMPTY_INDEX),
        index: EMPTY_INDEX,
    };

    return {
        model: state.model,
        expansion: state.expansion,
        rowAt: (position) => rowAt(state, position),
        sync: (index) => {
            syncModel(state, index);
        },
    };
}

class LazyLevelStore extends GObject.Object implements Gio.ListModelImpl {
    declare itemsChanged: Gio.ListModel["itemsChanged"];
    level: Level = { path: "", items: [], expandableFlags: [] };
    refs: SlotRef[] = [];
    objects: (Gtk.StringObject | null)[] = [];
    childStores: (LevelStore | null)[] = [];

    private createItem(position: number, ref: SlotRef): Gtk.StringObject {
        const created = Gtk.StringObject.new("");
        this.objects[position] = created;
        SLOTS.set(created, ref);

        return created;
    }

    vfuncGetItemType(): bigint {
        return GObject.TYPE_OBJECT;
    }

    vfuncGetNItems(): number {
        return this.refs.length;
    }

    vfuncGetItem(position: number): GObject.Object | null {
        const ref = this.refs[position];

        if (ref === undefined) {
            return null;
        }

        return this.objects[position] ?? this.createItem(position, ref);
    }
}

export { createCollectionModel, slotPathAt, slotRefFor, type CollectionModel, type SlotRef };
