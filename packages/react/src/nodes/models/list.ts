import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { CommitPriority, scheduleAfterCommit } from "../../scheduler.js";
import { ListStore } from "../internal/list-store.js";
import { signalStore } from "../internal/signal-store.js";
import { ListItemNode } from "../list-item.js";
import { VirtualNode } from "../virtual.js";

export type ListProps = {
    selectionMode?: Gtk.SelectionMode;
    selected?: string[];
    onSelectionChanged?: (ids: string[]) => void;
};

type SelectionModel = Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection;

export class List extends VirtualNode<ListProps> {
    private store: ListStore;
    private selectionModel: SelectionModel;
    private handleSelectionChange?: () => void;
    private pendingSelection?: string[];
    private selectionScheduled = false;

    constructor(props: ListProps = {}) {
        super("", {}, undefined);
        this.store = new ListStore();
        this.selectionModel = this.createSelectionModel(props.selectionMode);
        this.selectionModel.setModel(this.store.getModel());
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

    public getStore(): ListStore {
        return this.store;
    }

    public getSelectionModel(): SelectionModel {
        return this.selectionModel;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            return;
        }

        child.setStore(this.store);
        this.store.addItem(child.props.id, child.props.value);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof ListItemNode) || !(before instanceof ListItemNode)) {
            return;
        }

        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, child.props.value);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            return;
        }

        this.store.removeItem(child.props.id);
        child.setStore(null);
    }

    public updateProps(oldProps: ListProps | null, newProps: ListProps): void {
        super.updateProps(oldProps, newProps);

        if (oldProps && oldProps.selectionMode !== newProps.selectionMode) {
            signalStore.set(this, this.selectionModel, "selection-changed", null);
            this.selectionModel = this.createSelectionModel(newProps.selectionMode);
            this.selectionModel.setModel(this.store.getModel());
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
        const model = this.store.getModel();
        const selectionMode = mode ?? Gtk.SelectionMode.SINGLE;

        if (selectionMode === Gtk.SelectionMode.NONE) {
            return new Gtk.NoSelection(model);
        }

        if (selectionMode === Gtk.SelectionMode.MULTIPLE) {
            return new Gtk.MultiSelection(model);
        }

        const selectionModel = new Gtk.SingleSelection(model);
        selectionModel.setAutoselect(selectionMode === Gtk.SelectionMode.BROWSE);
        selectionModel.setCanUnselect(selectionMode !== Gtk.SelectionMode.BROWSE);

        return selectionModel;
    }

    private getSelection(): string[] {
        const model = this.store.getModel();
        const selection = this.selectionModel.getSelection();
        const size = selection.getSize();
        const ids: string[] = [];

        for (let i = 0; i < size; i++) {
            const index = selection.getNth(i);
            const id = model.getString(index);

            if (id !== null) {
                ids.push(id);
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

        const model = this.store.getModel();
        const nItems = model.getNItems();
        const selected = new Gtk.Bitset();
        const mask = Gtk.Bitset.newRange(0, nItems);

        if (ids) {
            for (const id of ids) {
                const index = model.find(id);

                if (index < nItems) {
                    selected.add(index);
                }
            }
        }

        this.selectionModel.setSelection(selected, mask);
    }
}
