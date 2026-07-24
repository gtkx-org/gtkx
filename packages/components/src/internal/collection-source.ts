import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ItemNode, SectionNode } from "../types.js";

export type CollectionMode = "flat" | "tree" | "sections";

export type CollectionData = {
    items?: ItemNode<unknown>[] | undefined;
    sections?: SectionNode<unknown, unknown>[] | undefined;
};

export type CollectionEntry = {
    id: string;
    node: ItemNode<unknown>;
    holder: GObject.Object;
    childStore: Gio.ListStore | null;
    childShadow: GObject.Object[];
    sectionValue: unknown;
};

type SectionRecord = {
    store: Gio.ListStore;
    shadow: GObject.Object[];
};

const hasChildren = (node: ItemNode<unknown>): boolean => node.children !== undefined && node.children.length > 0;

export const collectionModeOf = (data: CollectionData): CollectionMode => {
    if (data.sections !== undefined) return "sections";
    return (data.items ?? []).some(hasChildren) ? "tree" : "flat";
};

const newStore = (): Gio.ListStore => new Gio.ListStore({ itemType: GObject.TYPE_OBJECT });

const sameOrder = (shadow: GObject.Object[], holders: GObject.Object[]): boolean =>
    shadow.length === holders.length && holders.every((holder, index) => shadow[index] === holder);

export class CollectionSource {
    mode: CollectionMode;
    presented: Gio.ListModel;
    treeModel: Gtk.TreeListModel | null = null;
    private root = newStore();
    private rootShadow: GObject.Object[] = [];
    private entries = new Map<string, CollectionEntry>();
    private holders = new Map<GObject.Object, CollectionEntry>();
    private sections = new Map<string, SectionRecord>();
    private seen = new Set<string>();
    private dirty = new Set<GObject.Object>();

    constructor(mode: CollectionMode) {
        this.mode = mode;
        if (mode === "tree") {
            this.treeModel = Gtk.TreeListModel.new(this.root, false, false, (holder) => this.childModelOf(holder));
            this.presented = this.treeModel;
        } else if (mode === "sections") {
            this.presented = Gtk.FlattenListModel.new(this.root);
        } else {
            this.presented = this.root;
        }
    }

    update(data: CollectionData): void {
        this.seen.clear();
        this.dirty.clear();
        if (this.mode === "sections") this.updateSections(data.sections ?? []);
        else this.syncStore(this.root, this.rootShadow, this.syncLevel(data.items ?? [], undefined));
        this.dropUnseen();
    }

    entryOfHolder(holder: GObject.Object): CollectionEntry | undefined {
        return this.holders.get(holder);
    }

    holderAt(position: number): GObject.Object | null {
        const item = this.presented.getItem(position);
        if (item === null) return null;
        return item instanceof Gtk.TreeListRow ? item.getItem() : item;
    }

    idAt(position: number): string | null {
        const holder = this.holderAt(position);
        return holder === null ? null : (this.holders.get(holder)?.id ?? null);
    }

    presentedSize(): number {
        return this.presented.getNItems();
    }

    positionsOf(ids: string[]): number[] {
        const wanted = new Set(ids);
        const positions: number[] = [];
        const count = this.presentedSize();
        for (let index = 0; index < count && positions.length < wanted.size; index++) {
            const id = this.idAt(index);
            if (id !== null && wanted.has(id)) positions.push(index);
        }
        return positions;
    }

    positionOfId(id: string): number {
        const count = this.presentedSize();
        for (let index = 0; index < count; index++) {
            if (this.idAt(index) === id) return index;
        }
        return -1;
    }

    private childModelOf(holder: GObject.Object): Gio.ListModel | null {
        const entry = this.holders.get(holder);
        if (entry === undefined || !hasChildren(entry.node)) return null;
        return entry.childStore;
    }

    private syncStore(store: Gio.ListStore, shadow: GObject.Object[], holders: GObject.Object[]): void {
        if (sameOrder(shadow, holders)) {
            holders.forEach((holder, index) => {
                if (this.dirty.has(holder)) store.splice(index, 1, [holder]);
            });
            return;
        }
        store.splice(0, shadow.length, holders);
        shadow.length = 0;
        for (const holder of holders) shadow.push(holder);
    }

    private updateSections(sections: SectionNode<unknown, unknown>[]): void {
        const active = new Set<string>();
        const stores = sections.map((section) => {
            active.add(section.id);
            const record = this.ensureSection(section.id);
            this.syncStore(record.store, record.shadow, this.syncLevel(section.data, section.value));
            return record.store;
        });
        for (const id of [...this.sections.keys()]) {
            if (!active.has(id)) this.sections.delete(id);
        }
        this.syncStore(this.root, this.rootShadow, stores);
    }

    private ensureSection(id: string): SectionRecord {
        let record = this.sections.get(id);
        if (record === undefined) {
            record = { store: newStore(), shadow: [] };
            this.sections.set(id, record);
        }
        return record;
    }

    private syncLevel(nodes: ItemNode<unknown>[], sectionValue: unknown): GObject.Object[] {
        return nodes.map((node) => this.syncNode(node, sectionValue).holder);
    }

    private syncNode(node: ItemNode<unknown>, sectionValue: unknown): CollectionEntry {
        const entry = this.ensureEntry(node);
        entry.node = node;
        entry.sectionValue = sectionValue;
        this.seen.add(node.id);
        if (this.mode === "tree") this.syncChildren(entry, node);
        return entry;
    }

    private syncChildren(entry: CollectionEntry, node: ItemNode<unknown>): void {
        const children = node.children ?? [];
        const hadChildren = entry.childShadow.length > 0;
        if (children.length > 0) entry.childStore ??= newStore();
        if (entry.childStore !== null) {
            this.syncStore(entry.childStore, entry.childShadow, this.syncLevel(children, undefined));
        }
        if (hadChildren !== children.length > 0) this.dirty.add(entry.holder);
    }

    private ensureEntry(node: ItemNode<unknown>): CollectionEntry {
        let entry = this.entries.get(node.id);
        if (entry === undefined) {
            const holder = new GObject.Object({});
            entry = { id: node.id, node, holder, childStore: null, childShadow: [], sectionValue: undefined };
            this.entries.set(node.id, entry);
            this.holders.set(holder, entry);
        }
        return entry;
    }

    private dropUnseen(): void {
        for (const [id, entry] of [...this.entries]) {
            if (this.seen.has(id)) continue;
            this.entries.delete(id);
            this.holders.delete(entry.holder);
        }
    }
}
