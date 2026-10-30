import type { ReactNode, Ref } from "react";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { createElementComponent } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import type { CollectionIndex, Level } from "./collection-index.js";
import type { TreeExpansion } from "./tree-expansion.js";
import { createCollectionIndex } from "./collection-index.js";
import type { LevelKeys, Relocate, Splice } from "./level-splice.js";
import { encodePart } from "./keys.js";
import {
    findSplice,
    hasSplice,
    matchMoves,
    NO_SPLICE,
    relocateEntries,
    relocateSlot,
    searchableSplice,
} from "./level-splice.js";
import { adoptIndex, createTreeExpansion, pruneSlots, relocateSlots } from "./tree-expansion.js";

type LevelStore = Gio.ListModel & LazyLevelStore;

type SlotRef = {
    key: string;
    store: LazyLevelStore;
    slot: number;
};

type SlotItem = {
    ref: SlotRef;
    object: Gtk.StringObject;
};

type SyncContext = {
    index: CollectionIndex;
    expansion: TreeExpansion;
};

type SlotRun = {
    start: number;
    length: number;
};

type Serial = {
    value: number;
};

type ModelState = {
    version: number;
    listeners: Set<() => void>;
    root: CollectionRootStore | null;
    model: Gtk.FlattenListModel | null;
    groupStores: Map<number, LevelStore>;
    trees: Map<LevelStore, Gtk.TreeListModel>;
    expansion: TreeExpansion;
    index: CollectionIndex;
};

type CollectionModel = {
    expansion: TreeExpansion;
    subscribe: (onChange: () => void) => () => void;
    getVersion: () => number;
    isPending: (index: CollectionIndex) => boolean;
    rowAt: (position: number) => Gtk.TreeListRow | null;
    bind: (root: CollectionRootStore, model: Gtk.FlattenListModel) => void;
    clear: () => void;
    sync: (index: CollectionIndex, onSectionsFilled: () => void) => void;
};

type CollectionRootProps = { ref: Ref<CollectionRootStore> };

const STORE_CLASS_KEY = Symbol.for("gtkx.components.lazy-level-store");
const ROOT_CLASS_KEY = Symbol.for("gtkx.components.collection-root-store");
const SLOTS_KEY = Symbol.for("gtkx.components.lazy-level-store.slots");
const EMPTY_INDEX = createCollectionIndex(undefined, [], true);
const serial: Serial = { value: 0 };

function nextKey(): string {
    serial.value += 1;

    return String(serial.value);
}

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

function itemKeys(previous: Level, next: Level): LevelKeys {
    return {
        previousLength: previous.items.length,
        nextLength: next.items.length,
        previousKey: (slot) => previous.items[slot]?.id ?? "",
        nextKey: (slot) => next.items[slot]?.id ?? "",
    };
}

function groupKey(index: CollectionIndex, group: number): string {
    const level = index.groups[group];

    return level?.section?.id ?? "";
}

function groupKeys(previous: CollectionIndex, next: CollectionIndex): LevelKeys {
    return {
        previousLength: previous.groups.length,
        nextLength: next.groups.length,
        previousKey: (group) => groupKey(previous, group),
        nextKey: (group) => groupKey(next, group),
    };
}

function isExpandableAt(level: Level, slot: number): boolean {
    return level.expandableFlags[slot] ?? false;
}

function collectFlips(previous: Level, next: Level, splice: Splice): Set<number> {
    const flipped: Set<number> = new Set();

    if (previous.expandableFlags.length === 0 && next.expandableFlags.length === 0) {
        return flipped;
    }

    for (let slot = 0; slot < splice.start; slot++) {
        if (isExpandableAt(previous, slot) !== isExpandableAt(next, slot)) {
            flipped.add(slot);
        }
    }

    const shift = splice.added - splice.removed;

    for (let slot = splice.start + splice.removed; slot < previous.items.length; slot++) {
        if (isExpandableAt(previous, slot) !== isExpandableAt(next, slot + shift)) {
            flipped.add(slot + shift);
        }
    }

    return flipped;
}

function detachStore(store: LevelStore): void {
    for (const { ref } of store.slots.values()) {
        ref.slot = -1;
    }

    for (const child of store.childStores.values()) {
        detachStore(child);
    }
}

function pruneFlips(context: SyncContext, store: LevelStore, flipped: Set<number>): void {
    if (flipped.size === 0) {
        return;
    }

    pruneSlots(context.expansion, store.level.path, (slot) => flipped.has(slot));

    for (const slot of flipped) {
        const child = store.childStores.get(slot);

        if (child !== undefined) {
            detachStore(child);
            store.childStores.delete(slot);
        }
    }
}

function renewKeys(store: LevelStore, previous: Level, from: number, to: number): void {
    if (from === to) {
        return;
    }

    for (const [slot, { ref }] of store.slots) {
        if (slot >= from && slot < to && previous.items[slot]?.id !== store.level.items[slot]?.id) {
            ref.key = nextKey();
        }
    }
}

function relocateStore(context: SyncContext, store: LevelStore, keys: LevelKeys, splice: Splice): void {
    const moves = matchMoves(keys, splice, store.slots.keys());
    const shift: Relocate = (slot) => relocateSlot(splice, slot);

    store.slots = relocateEntries(
        store.slots,
        (slot) => relocateSlot(splice, slot, moves),
        ({ ref }) => {
            ref.slot = -1;
        },
    );

    for (const [slot, { ref }] of store.slots) {
        ref.slot = slot;
    }

    store.childStores = relocateEntries(store.childStores, shift, detachStore);
    relocateSlots(context.expansion, store.level.path, shift);
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
    const keys = itemKeys(previous, level);
    const found = previous.items === level.items ? NO_SPLICE : findSplice(keys);
    const splice = searchableSplice(found, found.added);
    store.level = level;
    renewKeys(store, previous, found.start, splice.start);

    if (hasSplice(splice)) {
        relocateStore(context, store, keys, splice);
    }

    const flipped = collectFlips(previous, level, splice);
    pruneFlips(context, store, flipped);

    if (hasSplice(splice)) {
        store.itemsChanged(splice.start, splice.removed, splice.added);
    }

    emitFlips(store, flipped);

    for (const [slot, child] of store.childStores) {
        const childLevel = context.index.childLevel(level, slot);

        if (childLevel !== undefined) {
            syncLevel(context, child, childLevel);
        }
    }
}

function ensureChildStore(index: CollectionIndex, store: LazyLevelStore, slot: number): LevelStore | null {
    const existing = store.childStores.get(slot) ?? null;

    if (existing !== null || !isExpandableAt(store.level, slot)) {
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

function dropGroup(state: ModelState, store: LevelStore): void {
    detachStore(store);
    state.trees.delete(store);
}

function replaceGroups(state: ModelState, before: number): void {
    for (const store of state.groupStores.values()) {
        dropGroup(state, store);
    }

    state.groupStores.clear();
    state.expansion.expanded.clear();
    state.expansion.slots.clear();
    state.root?.itemsChanged(0, before, state.index.groups.length);
}

function addedRows(index: CollectionIndex, splice: Splice): number {
    return index.groups
        .slice(splice.start, splice.start + splice.added)
        .reduce((rows, level) => rows + level.items.length, 0);
}

function syncRoot(state: ModelState, previous: CollectionIndex): void {
    if (previous.isTree !== state.index.isTree) {
        replaceGroups(state, previous.groups.length);

        return;
    }

    const keys = groupKeys(previous, state.index);
    const found = findSplice(keys);
    const splice = searchableSplice(found, addedRows(state.index, found));

    if (!hasSplice(splice)) {
        return;
    }

    const moves = matchMoves(keys, splice, state.groupStores.keys());
    const relocate: Relocate = (group) => relocateSlot(splice, group, moves);
    state.groupStores = relocateEntries(state.groupStores, relocate, (store) => {
        dropGroup(state, store);
    });
    relocateSlots(state.expansion, "", relocate);

    state.root?.itemsChanged(splice.start, splice.removed, splice.added);
}

function stepGroupStores(state: ModelState, context: SyncContext): void {
    for (const [group, store] of state.groupStores) {
        const level = context.index.groups[group];

        if (level !== undefined && store.level !== level) {
            syncLevel(context, store, level);
        }
    }
}

function rowCount(index: CollectionIndex): number {
    return index.groups.reduce((rows, level) => rows + level.items.length, 0);
}

function hasFilledSections(previous: CollectionIndex, index: CollectionIndex): boolean {
    return (
        rowCount(previous) === 0 && index.groups.some((level) => level.section !== undefined && level.items.length > 0)
    );
}

function syncModel(state: ModelState, index: CollectionIndex, onSectionsFilled: () => void): void {
    if (state.root === null) {
        return;
    }

    const context: SyncContext = { index, expansion: state.expansion };
    const previous = state.index;
    state.index = index;
    state.expansion.isSyncing = true;

    try {
        syncRoot(state, previous);
        stepGroupStores(state, context);

        if (hasFilledSections(previous, index)) {
            onSectionsFilled();
        }
    } finally {
        state.expansion.isSyncing = false;
    }

    adoptIndex(state.expansion, index);
    state.version += 1;

    for (const listener of state.listeners) {
        listener();
    }
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
        version: 0,
        listeners: new Set(),
        root: null,
        model: null,
        groupStores: new Map(),
        trees: new Map(),
        expansion: createTreeExpansion(EMPTY_INDEX),
        index: EMPTY_INDEX,
    };

    return {
        expansion: state.expansion,
        subscribe: (onChange) => {
            state.listeners.add(onChange);

            return () => {
                state.listeners.delete(onChange);
            };
        },
        getVersion: () => state.version,
        isPending: (index) => state.root !== null && state.index !== index,
        rowAt: (position) => rowAt(state, position),
        bind: (root, model) => {
            root.state = state;
            state.root = root;
            state.model = model;
        },
        clear: () => {
            clearModel(state);
        },
        sync: (index, onSectionsFilled) => {
            syncModel(state, index, onSectionsFilled);
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
    key: string = nextKey();
    level: Level = { path: "", items: [], expandableFlags: [] };
    slots: Map<number, SlotItem> = new Map();
    childStores: Map<number, LevelStore> = new Map();

    private createItem(position: number): Gtk.StringObject {
        const ref = { key: nextKey(), store: this, slot: position };
        const object = Gtk.StringObject.new("");
        this.slots.set(position, { ref, object });
        sharedSlots().set(object, ref);

        return object;
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

        return this.slots.get(position)?.object ?? this.createItem(position);
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
