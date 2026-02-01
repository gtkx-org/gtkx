import type * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { TreeListModelProps } from "../../jsx.js";
import { SelectionModelController } from "../internal/selection-model-controller.js";
import type { SignalStore } from "../internal/signal-store.js";
import { TreeStore } from "../internal/tree-store.js";
import { createTreeItemData, type TreeListItemNode } from "../tree-list-item.js";

type TreeListModelConfig = {
    owner: object;
    signalStore: SignalStore;
};

export class TreeListModel {
    private config: TreeListModelConfig;
    private store: TreeStore;
    private treeListModel: Gtk.TreeListModel;
    private selectionManager: SelectionModelController;

    constructor(config: TreeListModelConfig, props: TreeListModelProps = {}) {
        this.config = config;
        this.store = new TreeStore();

        this.treeListModel = new Gtk.TreeListModel(
            this.store.getRootModel(),
            false,
            props.autoexpand ?? false,
            (item: GObject.Object) => this.createChildModel(item),
        );

        this.selectionManager = new SelectionModelController(
            { ...config, ...props },
            this.treeListModel,
            () => this.getSelection(),
            (ids) => this.resolveSelectionIndices(ids),
            () => this.treeListModel.getNItems(),
        );
    }

    private createChildModel(item: GObject.Object): Gio.ListModel | null {
        if (!(item instanceof Gtk.StringObject)) return null;
        const parentId = item.getString();
        return this.store.getChildrenModel(parentId);
    }

    public getStore(): TreeStore {
        return this.store;
    }

    public getSelectionModel(): Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection {
        return this.selectionManager.getSelectionModel();
    }

    public appendChild(child: TreeListItemNode): void {
        child.setStore(this.store);
        this.addItemWithChildren(child);
    }

    private addItemWithChildren(node: TreeListItemNode, parentId?: string): void {
        const id = node.props.id;

        for (const child of node.getChildNodes()) {
            this.addItemWithChildren(child, id);
        }

        this.store.addItem(id, createTreeItemData(node.props), parentId);
    }

    public insertBefore(child: TreeListItemNode, before: TreeListItemNode): void {
        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, createTreeItemData(child.props));
    }

    public removeChild(child: TreeListItemNode): void {
        this.store.removeItem(child.props.id);
        child.setStore(null);
    }

    public updateProps(oldProps: TreeListModelProps | null, newProps: TreeListModelProps): void {
        if (!oldProps || oldProps.autoexpand !== newProps.autoexpand) {
            this.treeListModel.setAutoexpand(newProps.autoexpand ?? false);
        }

        this.selectionManager.update(
            oldProps ? { ...this.config, ...oldProps } : null,
            { ...this.config, ...newProps },
            this.treeListModel,
        );
    }

    private getSelection(): string[] {
        const selection = this.selectionManager.getSelectionModel().getSelection();
        const size = selection.getSize();
        const ids: string[] = [];

        for (let i = 0; i < size; i++) {
            const index = selection.getNth(i);
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
        const nItems = this.treeListModel.getNItems();
        const selected = new Gtk.Bitset();

        for (let i = 0; i < nItems; i++) {
            const row = this.treeListModel.getRow(i);
            if (!row) continue;

            const item = row.getItem();
            if (item instanceof Gtk.StringObject && ids.includes(item.getString())) {
                selected.add(i);
            }
        }

        return selected;
    }
}
