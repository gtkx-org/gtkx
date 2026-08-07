import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import type { CollectionIndex, Level } from "./collection-index.js";
import type { TreeExpansion } from "./tree-expansion.js";
import { createCollectionIndex } from "./collection-index.js";
import { encodePart } from "./keys.js";
import { adoptIndex, createTreeExpansion, pruneSlots, resetExpansion } from "./tree-expansion.js";

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

type ModelState = {
    root: Gio.ListStore;
    rootModels: GObject.Object[];
    model: Gtk.FlattenListModel;
    groupStores: LevelStore[];
    tree: Gtk.TreeListModel | null;
    treeRoot: LevelStore | null;
    expansion: TreeExpansion;
};

type CollectionModel = {
    model: Gtk.FlattenListModel;
    expansion: TreeExpansion;
    treeModel: () => Gtk.TreeListModel | null;
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
    return store.path + encodePart(String(slot));
}

function newLevelStore(path: string): LevelStore {
    const store = new (registeredStoreClass())() as LevelStore;
    store.path = path;

    return store;
}

function buildChildStore(context: SyncContext, path: string): LevelStore | null {
    const level = context.index.children.get(path);

    if (level === undefined) {
        return null;
    }

    const store = newLevelStore(path);
    growStore(context, store, level);

    return store;
}

function pushSlot(context: SyncContext, store: LevelStore, level: Level, slot: number): void {
    const canExpand = level.expandableFlags[slot] ?? false;
    store.refs.push({ store, slot });
    store.objects.push(null);
    store.expandableFlags.push(canExpand);
    store.childStores.push(canExpand ? buildChildStore(context, slotPathAt(store, slot)) : null);
}

function growStore(context: SyncContext, store: LevelStore, level: Level): void {
    for (let slot = store.refs.length; slot < level.items.length; slot++) {
        pushSlot(context, store, level, slot);
    }
}

function flipSlot(context: SyncContext, store: LevelStore, slot: number): void {
    const canExpand = !(store.expandableFlags[slot] ?? false);
    store.expandableFlags[slot] = canExpand;
    store.childStores[slot] = canExpand ? buildChildStore(context, slotPathAt(store, slot)) : null;
}

function collectFlips(store: LevelStore, level: Level): Set<number> {
    const overlap = Math.min(store.refs.length, level.items.length);
    const flipped: Set<number> = new Set();

    for (let slot = 0; slot < overlap; slot++) {
        if ((store.expandableFlags[slot] ?? false) !== (level.expandableFlags[slot] ?? false)) {
            flipped.add(slot);
        }
    }

    return flipped;
}

function syncOverlap(context: SyncContext, store: LevelStore, level: Level): Set<number> {
    const flipped = collectFlips(store, level);

    if (flipped.size === 0) {
        return flipped;
    }

    pruneSlots(context.expansion, store.path, (slot) => flipped.has(slot));

    for (const slot of flipped) {
        flipSlot(context, store, slot);
    }

    return flipped;
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
    pruneSlots(context.expansion, store.path, (slot) => slot >= nextLength);
    store.refs.length = nextLength;
    store.objects.length = nextLength;
    store.childStores.length = nextLength;
    store.expandableFlags.length = nextLength;
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

function stepChildStore(context: SyncContext, store: LevelStore, slot: number, flipped: Set<number>): void {
    const child = store.childStores[slot];

    if (child == null || flipped.has(slot)) {
        return;
    }

    const level = context.index.children.get(slotPathAt(store, slot));

    if (level !== undefined) {
        syncLevel(context, child, level);
    }
}

function syncLevel(context: SyncContext, store: LevelStore, level: Level): void {
    const previousLength = store.refs.length;
    const overlap = Math.min(previousLength, level.items.length);
    const flipped = syncOverlap(context, store, level);
    shrinkStore(context, store, level.items.length);
    growStore(context, store, level);
    emitTailSplice(store, previousLength, level.items.length);
    emitFlips(store, flipped);

    for (let slot = 0; slot < overlap; slot++) {
        stepChildStore(context, store, slot, flipped);
    }
}

function childStoreFor(object: GObject.Object): Gio.ListModel | null {
    const ref = slotRefFor(object);

    if (ref === null) {
        return null;
    }

    return ref.store.childStores[ref.slot] ?? null;
}

function ensureTree(state: ModelState, first: LevelStore): Gtk.TreeListModel {
    if (state.tree === null || state.treeRoot !== first) {
        state.tree = Gtk.TreeListModel.new(first, false, false, (object) => childStoreFor(object));
        state.treeRoot = first;
    }

    return state.tree;
}

function desiredRootModels(state: ModelState, index: CollectionIndex): GObject.Object[] {
    const [first] = state.groupStores;

    if (first !== undefined && index.isTree) {
        return [ensureTree(state, first)];
    }

    return [...state.groupStores];
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

function adjustGroupStores(state: ModelState, context: SyncContext): void {
    const { groups } = context.index;
    state.groupStores.length = Math.min(state.groupStores.length, groups.length);

    for (const level of groups.slice(state.groupStores.length)) {
        const store = newLevelStore(level.path);
        growStore(context, store, level);
        state.groupStores.push(store);
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
        tree: null,
        treeRoot: null,
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
    declare itemsChanged: Gio.ListModel["itemsChanged"];
    path = "";
    refs: SlotRef[] = [];
    objects: (Gtk.StringObject | null)[] = [];
    childStores: (LevelStore | null)[] = [];
    expandableFlags: boolean[] = [];

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
