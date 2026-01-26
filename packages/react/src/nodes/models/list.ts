import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { ListStore } from "../internal/list-store.js";
import { SelectionModelManager } from "../internal/selection-model.js";
import type { SignalStore } from "../internal/signal-store.js";
import { ListItemNode } from "../list-item.js";

export type ListProps = {
    selectionMode?: Gtk.SelectionMode;
    selected?: string[];
    onSelectionChanged?: (ids: string[]) => void;
};

type ListModelConfig = {
    owner: object;
    signalStore: SignalStore;
};

export class ListModel {
    private config: ListModelConfig;
    private store: ListStore;
    private selectionManager: SelectionModelManager;

    constructor(config: ListModelConfig, props: ListProps = {}) {
        this.config = config;
        this.store = new ListStore();
        this.selectionManager = new SelectionModelManager(
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

    public appendChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            return;
        }

        child.setStore(this.store);
        this.store.addItem(child.props.id, child.props.value);
    }

    public insertBefore(child: Node, before: Node): void {
        if (!(child instanceof ListItemNode) || !(before instanceof ListItemNode)) {
            return;
        }

        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, child.props.value);
    }

    public removeChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            return;
        }

        this.store.removeItem(child.props.id);
        child.setStore(null);
    }

    public updateProps(oldProps: ListProps | null, newProps: ListProps): void {
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
