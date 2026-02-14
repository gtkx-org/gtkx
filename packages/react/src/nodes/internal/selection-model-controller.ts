import type * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkListViewProps } from "../../jsx.js";
import type { SignalStore } from "./signal-store.js";

type SelectionModel = Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection;

type SelectionModelConfig = Pick<GtkListViewProps, "selectionMode" | "selected" | "onSelectionChanged"> & {
    owner: object;
    signalStore: SignalStore;
};

export class SelectionModelController {
    private owner: object;
    private signalStore: SignalStore;
    private selectionModel: SelectionModel;
    private getSelection: () => string[];
    private resolveSelectionIndices: (ids: string[]) => Gtk.Bitset;
    private getItemCount: () => number;

    constructor(
        config: SelectionModelConfig,
        model: Gio.ListModel,
        getSelection: () => string[],
        resolveSelectionIndices: (ids: string[]) => Gtk.Bitset,
        getItemCount: () => number,
    ) {
        this.owner = config.owner;
        this.signalStore = config.signalStore;
        this.selectionModel = this.createSelectionModel(config.selectionMode, model);
        this.selectionModel.setModel(model);
        this.getSelection = getSelection;
        this.resolveSelectionIndices = resolveSelectionIndices;
        this.getItemCount = getItemCount;
        this.initSelectionHandler(config.onSelectionChanged);
        this.setSelection(config.selected);
    }

    public getSelectionModel(): SelectionModel {
        return this.selectionModel;
    }

    public update(
        oldProps: SelectionModelConfig | null,
        newProps: SelectionModelConfig,
        model: Gio.ListModel,
    ): SelectionModel {
        if (oldProps && oldProps.selectionMode !== newProps.selectionMode) {
            this.signalStore.set(this.owner, this.selectionModel, "selection-changed", null);
            this.selectionModel = this.createSelectionModel(newProps.selectionMode, model);
            this.selectionModel.setModel(model);
            this.initSelectionHandler(newProps.onSelectionChanged);
            this.setSelection(newProps.selected);
            return this.selectionModel;
        }

        if (this.selectionModel.getModel() !== model) {
            this.selectionModel.setModel(model);
        }

        if (!oldProps || oldProps.onSelectionChanged !== newProps.onSelectionChanged) {
            this.initSelectionHandler(newProps.onSelectionChanged);
        }

        if (!oldProps || oldProps.selected !== newProps.selected) {
            this.setSelection(newProps.selected);
        }

        return this.selectionModel;
    }

    private initSelectionHandler(onSelectionChanged?: ((ids: string[]) => void) | null): void {
        if (!onSelectionChanged) {
            this.signalStore.set(this.owner, this.selectionModel, "selection-changed", null);
            return;
        }

        const handler = () => {
            onSelectionChanged(this.getSelection());
        };

        this.signalStore.set(this.owner, this.selectionModel, "selection-changed", handler);
    }

    private createSelectionModel(mode: Gtk.SelectionMode | null | undefined, model: Gio.ListModel): SelectionModel {
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

    public reapplySelection(ids?: string[] | null): void {
        this.setSelection(ids);
    }

    private setSelection(ids?: string[] | null): void {
        const nItems = this.getItemCount();
        const selected = ids ? this.resolveSelectionIndices(ids) : new Gtk.Bitset();
        const mask = Gtk.Bitset.newRange(0, nItems);

        if (this.selectionModel instanceof Gtk.SingleSelection) {
            const position = selected.getSize() > 0 ? selected.getNth(0) : Gtk.INVALID_LIST_POSITION;
            this.selectionModel.setSelected(position);
        } else {
            this.selectionModel.setSelection(selected, mask);
        }
    }
}
