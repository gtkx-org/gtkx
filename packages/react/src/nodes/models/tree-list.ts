import type * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { signalStore } from "../internal/signal-store.js";
import { TreeStore } from "../internal/tree-store.js";
import { TreeListItemNode } from "../tree-list-item.js";
import { VirtualNode } from "../virtual.js";

export type TreeListProps = {
    autoexpand?: boolean;
    selectionMode?: Gtk.SelectionMode;
    selected?: string[];
    onSelectionChanged?: (ids: string[]) => void;
};

export class TreeList extends VirtualNode<TreeListProps> {
    private store: TreeStore;
    private treeListModel: Gtk.TreeListModel;
    private selectionModel: Gtk.SingleSelection | Gtk.MultiSelection;
    private handleSelectionChange?: () => void;

    constructor(autoexpand = false, selectionMode?: Gtk.SelectionMode) {
        super("", {}, undefined);
        this.store = new TreeStore();

        this.treeListModel = new Gtk.TreeListModel(
            this.store.getRootModel(),
            false,
            autoexpand,
            (item: GObject.GObject) => this.createChildModel(item),
        );

        this.selectionModel = this.createSelectionModel(selectionMode);
        this.selectionModel.setModel(this.treeListModel);
    }

    private createChildModel(item: GObject.GObject): Gio.ListModel | null {
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

    public getSelectionModel(): Gtk.SingleSelection | Gtk.MultiSelection {
        return this.selectionModel;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            return;
        }

        if (!child.props.id) {
            throw new Error("Cannot append 'TreeListItem' to 'TreeList': missing required 'id' prop");
        }

        child.setStore(this.store);
        this.store.addItem(child.props.id, {
            value: child.props.value,
            indentForDepth: child.props.indentForDepth,
            indentForIcon: child.props.indentForIcon,
            hideExpander: child.props.hideExpander,
        });
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof TreeListItemNode) || !(before instanceof TreeListItemNode)) {
            return;
        }

        if (!child.props.id) {
            throw new Error("Cannot insert 'TreeListItem' into 'TreeList': missing required 'id' prop");
        }

        if (!before.props.id) {
            throw new Error("Cannot insert 'TreeListItem' into 'TreeList': 'before' node missing required 'id' prop");
        }

        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, {
            value: child.props.value,
            indentForDepth: child.props.indentForDepth,
            indentForIcon: child.props.indentForIcon,
            hideExpander: child.props.hideExpander,
        });
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            return;
        }

        if (!child.props.id) {
            throw new Error("Cannot remove 'TreeListItem' from 'TreeList': missing required 'id' prop");
        }

        this.store.removeItem(child.props.id);
        child.setStore(null);
    }

    public updateProps(oldProps: TreeListProps | null, newProps: TreeListProps): void {
        super.updateProps(oldProps, newProps);

        if (!oldProps || oldProps.autoexpand !== newProps.autoexpand) {
            this.treeListModel.setAutoexpand(newProps.autoexpand ?? false);
        }

        if (!oldProps || oldProps.selectionMode !== newProps.selectionMode) {
            signalStore.set(this, this.selectionModel, "selection-changed", null);
            this.selectionModel = this.createSelectionModel(newProps.selectionMode);
            this.selectionModel.setModel(this.treeListModel);
        }

        if (
            !oldProps ||
            oldProps.onSelectionChanged !== newProps.onSelectionChanged ||
            oldProps.selectionMode !== newProps.selectionMode
        ) {
            const onSelectionChanged = newProps.onSelectionChanged;

            this.handleSelectionChange = () => {
                onSelectionChanged?.(this.getSelection());
            };

            signalStore.set(
                this,
                this.selectionModel,
                "selection-changed",
                newProps.onSelectionChanged ? this.handleSelectionChange : null,
            );
        }

        if (!oldProps || oldProps.selected !== newProps.selected || oldProps.selectionMode !== newProps.selectionMode) {
            this.setSelection(newProps.selected);
        }
    }

    private createSelectionModel(mode?: Gtk.SelectionMode): Gtk.SingleSelection | Gtk.MultiSelection {
        const selectionMode = mode ?? Gtk.SelectionMode.SINGLE;

        const selectionModel =
            selectionMode === Gtk.SelectionMode.MULTIPLE
                ? new Gtk.MultiSelection(this.treeListModel)
                : new Gtk.SingleSelection(this.treeListModel);

        if (selectionModel instanceof Gtk.SingleSelection) {
            selectionModel.setAutoselect(false);
            selectionModel.setCanUnselect(true);
        }

        return selectionModel;
    }

    private getSelection(): string[] {
        const selection = this.selectionModel.getSelection();
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

    private setSelection(ids?: string[]): void {
        const nItems = this.treeListModel.getNItems();
        const selected = new Gtk.Bitset();
        const mask = Gtk.Bitset.newRange(0, nItems);

        if (ids) {
            for (let i = 0; i < nItems; i++) {
                const row = this.treeListModel.getRow(i);
                if (!row) continue;

                const item = row.getItem();
                if (item instanceof Gtk.StringObject && ids.includes(item.getString())) {
                    selected.add(i);
                }
            }
        }

        this.selectionModel.setSelection(selected, mask);
    }
}
