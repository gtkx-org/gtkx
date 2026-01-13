import type * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { CommitPriority, scheduleAfterCommit } from "../../scheduler.js";
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

type SelectionModel = Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection;

export class TreeList extends VirtualNode<TreeListProps> {
    private store: TreeStore;
    private treeListModel: Gtk.TreeListModel;
    private selectionModel: SelectionModel;
    private handleSelectionChange?: () => void;
    private pendingSelection?: string[];
    private selectionScheduled = false;

    constructor(props: TreeListProps = {}) {
        super("", {}, undefined);
        this.store = new TreeStore();

        this.treeListModel = new Gtk.TreeListModel(
            this.store.getRootModel(),
            false,
            props.autoexpand ?? false,
            (item: GObject.GObject) => this.createChildModel(item),
        );

        this.selectionModel = this.createSelectionModel(props.selectionMode);
        this.selectionModel.setModel(this.treeListModel);
        this.initSelectionHandler(props.onSelectionChanged);
    }

    private initSelectionHandler(onSelectionChanged?: (ids: string[]) => void): void {
        if (!onSelectionChanged) {
            signalStore.set(this, this.selectionModel, "selection-changed", null);
            return;
        }

        this.handleSelectionChange = () => {
            onSelectionChanged(this.getSelection());
        };

        signalStore.set(this, this.selectionModel, "selection-changed", this.handleSelectionChange);
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

    public getSelectionModel(): SelectionModel {
        return this.selectionModel;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            return;
        }

        if (!child.props.id) {
            throw new Error("Cannot append 'TreeListItem' to 'TreeList': missing required 'id' prop");
        }

        const id = child.props.id;
        child.setStore(this.store);

        scheduleAfterCommit(() => {
            this.store.addItem(id, {
                value: child.props.value,
                indentForDepth: child.props.indentForDepth,
                indentForIcon: child.props.indentForIcon,
                hideExpander: child.props.hideExpander,
            });
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

        const id = child.props.id;
        const beforeId = before.props.id;
        child.setStore(this.store);

        scheduleAfterCommit(() => {
            this.store.insertItemBefore(id, beforeId, {
                value: child.props.value,
                indentForDepth: child.props.indentForDepth,
                indentForIcon: child.props.indentForIcon,
                hideExpander: child.props.hideExpander,
            });
        });
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            return;
        }

        if (!child.props.id) {
            throw new Error("Cannot remove 'TreeListItem' from 'TreeList': missing required 'id' prop");
        }

        const id = child.props.id;

        scheduleAfterCommit(() => {
            this.store.removeItem(id);
        });

        child.setStore(null);
    }

    public updateProps(oldProps: TreeListProps | null, newProps: TreeListProps): void {
        super.updateProps(oldProps, newProps);

        if (!oldProps || oldProps.autoexpand !== newProps.autoexpand) {
            this.treeListModel.setAutoexpand(newProps.autoexpand ?? false);
        }

        if (oldProps && oldProps.selectionMode !== newProps.selectionMode) {
            signalStore.set(this, this.selectionModel, "selection-changed", null);
            this.selectionModel = this.createSelectionModel(newProps.selectionMode);
            this.selectionModel.setModel(this.treeListModel);
            this.initSelectionHandler(newProps.onSelectionChanged);
            this.setSelection(newProps.selected);
            return;
        }

        if (!oldProps || oldProps.onSelectionChanged !== newProps.onSelectionChanged) {
            this.initSelectionHandler(newProps.onSelectionChanged);
        }

        if (!oldProps || oldProps.selected !== newProps.selected) {
            this.setSelection(newProps.selected);
        }
    }

    private createSelectionModel(mode?: Gtk.SelectionMode): SelectionModel {
        const selectionMode = mode ?? Gtk.SelectionMode.SINGLE;

        if (selectionMode === Gtk.SelectionMode.NONE) {
            return new Gtk.NoSelection(this.treeListModel);
        }

        if (selectionMode === Gtk.SelectionMode.MULTIPLE) {
            return new Gtk.MultiSelection(this.treeListModel);
        }

        const selectionModel = new Gtk.SingleSelection(this.treeListModel);
        selectionModel.setAutoselect(selectionMode === Gtk.SelectionMode.BROWSE);
        selectionModel.setCanUnselect(selectionMode !== Gtk.SelectionMode.BROWSE);

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
        this.pendingSelection = ids;

        if (!this.selectionScheduled) {
            this.selectionScheduled = true;
            scheduleAfterCommit(() => this.applySelection(), CommitPriority.LOW);
        }
    }

    private applySelection(): void {
        this.selectionScheduled = false;
        const ids = this.pendingSelection;
        this.pendingSelection = undefined;

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
