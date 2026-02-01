import * as Gtk from "@gtkx/ffi/gtk";
import type { ListModelProps } from "../../jsx.js";
import { ListStore } from "../internal/list-store.js";
import { SelectionModelController } from "../internal/selection-model-controller.js";
import type { SignalStore } from "../internal/signal-store.js";
import type { ListItemNode } from "../list-item.js";

type ListModelConfig = {
    owner: object;
    signalStore: SignalStore;
};

export class ListModel {
    private config: ListModelConfig;
    private store: ListStore;
    private selectionManager: SelectionModelController;

    constructor(config: ListModelConfig, props: ListModelProps = {}) {
        this.config = config;
        this.store = new ListStore();
        this.selectionManager = new SelectionModelController(
            { ...config, ...props },
            this.store.getModel(),
            () => this.getSelection(),
            (ids) => this.resolveSelectionIndices(ids),
            () => this.store.getModel().getNItems(),
        );
    }

    public getStore(): ListStore {
        return this.store;
    }

    public getSelectionModel(): Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection {
        return this.selectionManager.getSelectionModel();
    }

    public appendChild(child: ListItemNode): void {
        child.setStore(this.store);
        this.store.addItem(child.props.id, child.props.value);
    }

    public insertBefore(child: ListItemNode, before: ListItemNode): void {
        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, child.props.value);
    }

    public removeChild(child: ListItemNode): void {
        this.store.removeItem(child.props.id);
        child.setStore(null);
    }

    public updateProps(oldProps: ListModelProps | null, newProps: ListModelProps): void {
        this.selectionManager.update(
            oldProps ? { ...this.config, ...oldProps } : null,
            { ...this.config, ...newProps },
            this.store.getModel(),
        );
    }

    private getSelection(): string[] {
        const model = this.store.getModel();
        const selection = this.selectionManager.getSelectionModel().getSelection();
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

    private resolveSelectionIndices(ids: string[]): Gtk.Bitset {
        const model = this.store.getModel();
        const nItems = model.getNItems();
        const selected = new Gtk.Bitset();

        for (const id of ids) {
            const index = model.find(id);
            if (index < nItems) {
                selected.add(index);
            }
        }

        return selected;
    }
}
