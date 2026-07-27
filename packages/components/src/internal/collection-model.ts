import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { Item, Section } from "../types.js";

type CollectionMode = "flat" | "tree" | "sections";

type CollectionData = {
    items?: Item[] | undefined;
    sections?: Section[] | undefined;
};

type CollectionEntry = {
    id: string;
    item: Item;
    holder: GObject.Object;
    childStore: Gio.ListStore | null;
    childOrder: GObject.Object[];
    sectionValue: unknown;
};

type CollectionModel = {
    mode: CollectionMode;
    model: Gio.ListModel;
    treeModel: Gtk.TreeListModel | null;
    update: (data: CollectionData) => void;
    entryFor: (holder: GObject.Object) => CollectionEntry | undefined;
    idAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    positionsFor: (ids: string[]) => number[];
};

type SectionStore = { store: Gio.ListStore; order: GObject.Object[] };

type ModelState = {
    mode: CollectionMode;
    root: Gio.ListStore;
    rootOrder: GObject.Object[];
    entries: Map<string, CollectionEntry>;
    holders: Map<GObject.Object, CollectionEntry>;
    sections: Map<string, SectionStore>;
    seen: Set<string>;
    dirty: Set<GObject.Object>;
};

const hasChildren = (item: Item): boolean => item.children !== undefined && item.children.length > 0;

const getCollectionMode = (data: CollectionData): CollectionMode => {
    if (data.sections !== undefined) {
        return "sections";
    }

    return (data.items ?? []).some((item) => hasChildren(item)) ? "tree" : "flat";
};

const newStore = (): Gio.ListStore => new Gio.ListStore({ itemType: GObject.TYPE_OBJECT });

const hasSameOrder = (order: GObject.Object[], next: GObject.Object[]): boolean =>
    order.length === next.length && next.every((holder, index) => order[index] === holder);

const refreshDirty = (state: ModelState, store: Gio.ListStore, order: GObject.Object[]): void => {
    for (const [index, holder] of order.entries()) {
        if (state.dirty.has(holder)) {
            store.itemsChanged(index, 1, 1);
        }
    }
};

const syncStore = (state: ModelState, store: Gio.ListStore, order: GObject.Object[], next: GObject.Object[]): void => {
    if (hasSameOrder(order, next)) {
        refreshDirty(state, store, next);

        return;
    }

    store.splice(0, order.length, next);
    order.length = 0;

    for (const holder of next) {
        order.push(holder);
    }
};

const getOrCreateEntry = (state: ModelState, item: Item): CollectionEntry => {
    const existing = state.entries.get(item.id);

    if (existing !== undefined) {
        return existing;
    }

    const holder = new GObject.Object({});

    const entry: CollectionEntry = {
        id: item.id,
        item,
        holder,
        childStore: null,
        childOrder: [],
        sectionValue: undefined,
    };

    state.entries.set(item.id, entry);
    state.holders.set(holder, entry);

    return entry;
};

const syncLevel = (state: ModelState, items: Item[], sectionValue: unknown): GObject.Object[] =>
    items.map((item) => {
        const entry = getOrCreateEntry(state, item);
        entry.item = item;
        entry.sectionValue = sectionValue;
        state.seen.add(item.id);

        if (state.mode === "tree") {
            syncChildren(state, entry, item.children ?? []);
        }

        return entry.holder;
    });

function syncChildren(state: ModelState, entry: CollectionEntry, children: Item[]): void {
    const isHad = entry.childOrder.length > 0;

    if (children.length > 0) {
        entry.childStore ??= newStore();
    }

    if (entry.childStore !== null) {
        syncStore(state, entry.childStore, entry.childOrder, syncLevel(state, children, undefined));
    }

    if (isHad !== (children.length > 0)) {
        state.dirty.add(entry.holder);
    }
}

const syncSections = (state: ModelState, next: Section[]): void => {
    const active = new Set(next.map((section) => section.id));

    for (const id of state.sections.keys()) {
        if (!active.has(id)) {
            state.sections.delete(id);
        }
    }

    const stores = next.map((section) => {
        let record = state.sections.get(section.id);

        if (record === undefined) {
            record = { store: newStore(), order: [] };
            state.sections.set(section.id, record);
        }

        syncStore(state, record.store, record.order, syncLevel(state, section.data, section.value));

        return record.store;
    });

    syncStore(state, state.root, state.rootOrder, stores);
};

const pruneUnseen = (state: ModelState): void => {
    for (const [id, entry] of state.entries) {
        if (state.seen.has(id)) {
            continue;
        }

        state.entries.delete(id);
        state.holders.delete(entry.holder);
    }
};

const update = (state: ModelState, data: CollectionData): void => {
    state.seen = new Set();
    state.dirty = new Set();

    if (state.mode === "sections") {
        syncSections(state, data.sections ?? []);
    } else {
        syncStore(state, state.root, state.rootOrder, syncLevel(state, data.items ?? [], undefined));
    }

    pruneUnseen(state);
};

const idAt = (state: ModelState, model: Gio.ListModel, position: number): string | null => {
    const item = model.getItem(position);

    if (item === null) {
        return null;
    }

    const holder = item instanceof Gtk.TreeListRow ? item.getItem() : item;

    return holder === null ? null : (state.holders.get(holder)?.id ?? null);
};

const isWanted = (id: string | null, wanted: Set<string>): boolean => id !== null && wanted.has(id);

const findPositions = (state: ModelState, model: Gio.ListModel, ids: string[]): number[] => {
    const wanted = new Set(ids);
    const positions: number[] = [];
    const count = model.getNItems();

    for (let index = 0; index < count && positions.length < wanted.size; index++) {
        if (isWanted(idAt(state, model, index), wanted)) {
            positions.push(index);
        }
    }

    return positions;
};

const childModelFor = (state: ModelState, holder: GObject.Object): Gio.ListStore | null => {
    const entry = state.holders.get(holder);

    if (entry === undefined || !hasChildren(entry.item)) {
        return null;
    }

    return entry.childStore;
};

const presentedModel = (state: ModelState): { model: Gio.ListModel; treeModel: Gtk.TreeListModel | null } => {
    if (state.mode === "tree") {
        const treeModel = Gtk.TreeListModel.new(state.root, false, false, (holder) => childModelFor(state, holder));

        return { model: treeModel, treeModel };
    }

    if (state.mode === "sections") {
        return { model: Gtk.FlattenListModel.new(state.root), treeModel: null };
    }

    return { model: state.root, treeModel: null };
};

const createCollectionModel = (mode: CollectionMode): CollectionModel => {
    const state: ModelState = {
        mode,
        root: newStore(),
        rootOrder: [],
        entries: new Map(),
        holders: new Map(),
        sections: new Map(),
        seen: new Set(),
        dirty: new Set(),
    };

    const { model, treeModel } = presentedModel(state);

    return {
        mode,
        model,
        treeModel,
        update: (data) => {
            update(state, data);
        },
        entryFor: (holder) => state.holders.get(holder),
        idAt: (position) => idAt(state, model, position),
        positionFor: (id) => {
            const count = model.getNItems();

            for (let index = 0; index < count; index++) {
                if (idAt(state, model, index) === id) {
                    return index;
                }
            }

            return -1;
        },
        positionsFor: (ids) => findPositions(state, model, ids),
    };
};

export {
    getCollectionMode,
    createCollectionModel,
    type CollectionMode,
    type CollectionData,
    type CollectionEntry,
    type CollectionModel,
};
