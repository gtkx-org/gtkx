import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { ListStore } from "../internal/list-store.js";
import { ListItemNode } from "../list-item.js";
import { VirtualNode } from "../virtual.js";

export type ListProps = {
    selectionMode?: Gtk.SelectionMode;
    selected?: string[];
    onSelectionChanged?: (ids: string[]) => void;
};

export class List extends VirtualNode<ListProps> {
    private store: ListStore;
    private selectionModel: Gtk.SingleSelection | Gtk.MultiSelection;
    private handleSelectionChange?: () => void;

    constructor(selectionMode?: Gtk.SelectionMode) {
        super("", {}, undefined);
        this.store = new ListStore();
        this.selectionModel = this.createSelectionModel(selectionMode);
        this.selectionModel.setModel(this.store.getModel());
    }

    public getStore(): ListStore {
        return this.store;
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
        child.setStore(undefined);
    }

    public updateProps(oldProps: ListProps | null, newProps: ListProps): void {
        super.updateProps(oldProps, newProps);

        if (!oldProps || oldProps.selectionMode !== newProps.selectionMode) {
            this.signalStore.set(this.selectionModel, "selection-changed", undefined);
            this.selectionModel = this.createSelectionModel(newProps.selectionMode);
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

            this.signalStore.set(
                this.selectionModel,
                "selection-changed",
                newProps.onSelectionChanged ? this.handleSelectionChange : undefined,
            );
        }

        if (!oldProps || oldProps.selected !== newProps.selected || oldProps.selectionMode !== newProps.selectionMode) {
            this.signalStore.block(() => this.setSelection(newProps.selected));
        }
    }

    private createSelectionModel(mode?: Gtk.SelectionMode): Gtk.SingleSelection | Gtk.MultiSelection {
        const model = this.store.getModel();
        const selectionMode = mode ?? Gtk.SelectionMode.SINGLE;

        const selectionModel =
            selectionMode === Gtk.SelectionMode.MULTIPLE
                ? new Gtk.MultiSelection(model)
                : new Gtk.SingleSelection(model);

        if (selectionModel instanceof Gtk.SingleSelection) {
            selectionModel.setAutoselect(false);
            selectionModel.setCanUnselect(true);
        }

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
