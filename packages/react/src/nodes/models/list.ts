import type * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkListViewProps } from "../../jsx.js";
import { ListStore } from "../internal/list-store.js";
import { getSelectionFromStore, resolveSelectionIndices } from "../internal/selection-helpers.js";
import { SelectionModelController } from "../internal/selection-model-controller.js";
import type { SignalStore } from "../internal/signal-store.js";
import { TreeStore } from "../internal/tree-store.js";
import { ListItemNode } from "../list-item.js";
import { ListSectionNode } from "../list-section.js";

export type ListModelProps = Pick<GtkListViewProps, "autoexpand" | "selectionMode" | "selected" | "onSelectionChanged">;

type ListModelConfig = {
    owner: object;
    signalStore: SignalStore;
};

export class ListModel {
    private config: ListModelConfig;
    private flatMode: boolean;

    private treeStore: TreeStore | null = null;
    private treeListModel: Gtk.TreeListModel | null = null;

    private flatStore: ListStore | null = null;

    private selectionManager: SelectionModelController;
    private initialSelected: string[] | null | undefined;

    constructor(config: ListModelConfig, props: ListModelProps = {}, flat = false) {
        this.config = config;
        this.flatMode = flat;
        this.initialSelected = props.selected;

        let model: Gio.ListModel;

        if (flat) {
            const store = new ListStore();
            store.beginBatch();
            this.flatStore = store;
            model = store.getModel();
        } else {
            const store = new TreeStore();
            store.beginBatch();
            this.treeStore = store;
            this.treeListModel = new Gtk.TreeListModel(
                store.getRootModel(),
                false,
                props.autoexpand ?? false,
                (item: GObject.Object) => this.createChildModel(item),
            );
            model = this.treeListModel;
        }

        this.selectionManager = new SelectionModelController(
            { ...config, ...props },
            model,
            () => this.getSelection(),
            (ids) => this.resolveSelectionIndices(ids),
            () => this.getNItems(),
        );
    }

    public isFlatMode(): boolean {
        return this.flatMode;
    }

    public flushBatch(): void {
        if (this.flatStore) {
            this.flatStore.flushBatch();
            const model = this.flatStore.getModel();
            if (this.selectionManager.getSelectionModel().getModel() !== model) {
                this.selectionManager.update(null, { ...this.config }, model);
            }
        } else if (this.treeStore) {
            this.treeStore.flushBatch();
        }
        this.selectionManager.reapplySelection(this.initialSelected);
        this.initialSelected = undefined;
    }

    private createChildModel(item: GObject.Object): Gio.ListModel | null {
        if (!this.treeStore) return null;
        if (!(item instanceof Gtk.StringObject)) return null;
        const parentId = item.getString();
        return this.treeStore.getChildrenModel(parentId);
    }

    public getStore(): TreeStore {
        if (!this.treeStore) {
            throw new Error("getStore() called in flat mode. Use getFlatStore() instead.");
        }
        return this.treeStore;
    }

    public getFlatStore(): ListStore {
        if (!this.flatStore) {
            throw new Error("getFlatStore() called in tree mode. Use getStore() instead.");
        }
        return this.flatStore;
    }

    public setOnItemUpdated(callback: (id: string) => void): void {
        if (this.flatStore) {
            this.flatStore.setOnItemUpdated(callback);
        } else if (this.treeStore) {
            this.treeStore.setOnItemUpdated(callback);
        }
    }

    public getSelectionModel(): Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection {
        return this.selectionManager.getSelectionModel();
    }

    public appendChild(child: ListItemNode | ListSectionNode): void {
        if (this.flatStore) {
            if (child instanceof ListSectionNode) {
                this.flatStore.addSection(child.props.id, child.props.value);
                child.setStore(this.flatStore);
            } else {
                child.setStore(this.flatStore);
                this.flatStore.addItem(child.props.id, child.props.value);
            }
        } else if (child instanceof ListItemNode && this.treeStore) {
            child.setStore(this.treeStore);
            this.addItemWithChildren(child);
        }
    }

    private addItemWithChildren(node: ListItemNode, parentId?: string): void {
        if (!this.treeStore) return;
        const id = node.props.id;

        for (const child of node.getChildNodes()) {
            this.addItemWithChildren(child, id);
        }

        this.treeStore.addItem(id, ListItemNode.createItemData(node.props), parentId);
    }

    public insertBefore(child: ListItemNode | ListSectionNode, before: ListItemNode | ListSectionNode): void {
        if (this.flatStore) {
            if (child instanceof ListSectionNode) {
                this.flatStore.addSection(child.props.id, child.props.value);
                child.setStore(this.flatStore);
                return;
            }
            if (before instanceof ListSectionNode) {
                child.setStore(this.flatStore);
                this.flatStore.addItem(child.props.id, child.props.value);
                return;
            }
            child.setStore(this.flatStore);
            this.flatStore.insertItemBefore(child.props.id, before.props.id, child.props.value);
        } else if (child instanceof ListItemNode && before instanceof ListItemNode && this.treeStore) {
            child.setStore(this.treeStore);
            this.treeStore.insertItemBefore(child.props.id, before.props.id, ListItemNode.createItemData(child.props));
        }
    }

    public removeChild(child: ListItemNode | ListSectionNode): void {
        if (this.flatStore) {
            if (child instanceof ListSectionNode) {
                this.flatStore.removeSection(child.props.id);
                child.setStore(null);
            } else {
                this.flatStore.removeItem(child.props.id);
                child.setStore(null);
            }
        } else if (child instanceof ListItemNode && this.treeStore) {
            this.treeStore.removeItem(child.props.id);
            child.setStore(null);
        }
    }

    public updateProps(oldProps: ListModelProps | null, newProps: ListModelProps): void {
        if (this.treeListModel) {
            if (!oldProps || oldProps.autoexpand !== newProps.autoexpand) {
                this.treeListModel.setAutoexpand(newProps.autoexpand ?? false);
            }
        }

        const model = this.flatStore ? this.flatStore.getModel() : this.treeListModel;
        if (model) {
            this.selectionManager.update(
                oldProps ? { ...this.config, ...oldProps } : null,
                { ...this.config, ...newProps },
                model,
            );
        }
    }

    private getNItems(): number {
        if (this.flatStore) {
            return this.flatStore.getNItems();
        }
        if (this.treeListModel) {
            return this.treeListModel.getNItems();
        }
        return 0;
    }

    private getSelection(): string[] {
        const selection = this.selectionManager.getSelectionModel().getSelection();

        if (this.flatStore) {
            return getSelectionFromStore(selection, this.flatStore);
        }

        const size = selection.getSize();
        const ids: string[] = [];
        for (let i = 0; i < size; i++) {
            const index = selection.getNth(i);
            if (!this.treeListModel) continue;
            const row = this.treeListModel.getRow(index);
            if (!row) continue;
            const item = row.getItem();
            if (item instanceof Gtk.StringObject) {
                ids.push(item.getString());
            }
        }

        return ids;
    }

    private resolveSelectionIndices(ids: string[]): Gtk.Bitset {
        if (this.flatStore) {
            return resolveSelectionIndices(ids, this.flatStore);
        }

        const selected = new Gtk.Bitset();
        if (!this.treeListModel) return selected;
        const nItems = this.treeListModel.getNItems();
        const idSet = new Set(ids);

        for (let i = 0; i < nItems; i++) {
            const row = this.treeListModel.getRow(i);
            if (!row) continue;

            const item = row.getItem();
            if (item instanceof Gtk.StringObject && idSet.has(item.getString())) {
                selected.add(i);
            }
        }

        return selected;
    }
}
