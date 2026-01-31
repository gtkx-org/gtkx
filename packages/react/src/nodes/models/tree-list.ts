import type * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import type { Container } from "../../types.js";
import { SelectionModelManager } from "../internal/selection-model.js";
import { TreeStore } from "../internal/tree-store.js";
import { createTreeItemData, TreeListItemNode } from "../tree-list-item.js";
import { VirtualNode } from "../virtual.js";

export type TreeListProps = {
    autoexpand?: boolean;
    selectionMode?: Gtk.SelectionMode;
    selected?: string[];
    onSelectionChanged?: (ids: string[]) => void;
};

export class TreeList extends VirtualNode<TreeListProps, Node, TreeListItemNode> {
    private store: TreeStore;
    private treeListModel: Gtk.TreeListModel;
    private selectionManager: SelectionModelManager;

    constructor(props: TreeListProps = {}, rootContainer: Container) {
        super("", {}, undefined, rootContainer);
        this.store = new TreeStore();

        this.treeListModel = new Gtk.TreeListModel(
            this.store.getRootModel(),
            false,
            props.autoexpand ?? false,
            (item: GObject.Object) => this.createChildModel(item),
        );

        this.selectionManager = new SelectionModelManager(
            { owner: this, signalStore: this.signalStore, ...props },
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

    public getTreeListModel(): Gtk.TreeListModel {
        return this.treeListModel;
    }

    public getSelectionModel(): Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection {
        return this.selectionManager.getSelectionModel();
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof TreeListItemNode;
    }

    public override appendChild(child: TreeListItemNode): void {
        super.appendChild(child);
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

    public override insertBefore(child: TreeListItemNode, before: TreeListItemNode): void {
        super.insertBefore(child, before);
        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, createTreeItemData(child.props));
    }

    public override removeChild(child: TreeListItemNode): void {
        this.store.removeItem(child.props.id);
        child.setStore(null);
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: TreeListProps | null, newProps: TreeListProps): void {
        super.commitUpdate(oldProps, newProps);

        if (!oldProps || oldProps.autoexpand !== newProps.autoexpand) {
            this.treeListModel.setAutoexpand(newProps.autoexpand ?? false);
        }

        this.selectionManager.update(
            oldProps ? { owner: this, signalStore: this.signalStore, ...oldProps } : null,
            { owner: this, signalStore: this.signalStore, ...newProps },
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
