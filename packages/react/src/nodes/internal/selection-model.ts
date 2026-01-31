import type * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { DeferredAction } from "./deferred-action.js";
import type { SignalStore } from "./signal-store.js";

type SelectionModel = Gtk.NoSelection | Gtk.SingleSelection | Gtk.MultiSelection;

export type SelectionModelConfig = {
    owner: object;
    signalStore: SignalStore;
    selectionMode?: Gtk.SelectionMode;
    selected?: string[];
    onSelectionChanged?: (ids: string[]) => void;
};

export class SelectionModelManager {
    private owner: object;
    private signalStore: SignalStore;
    private selectionModel: SelectionModel;
    private handleSelectionChange: (() => void) | null = null;
    private pendingSelection: string[] | null = null;
    private selectionAction: DeferredAction;
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
        this.selectionAction = new DeferredAction(() => this.applySelection());
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

        if (!oldProps || oldProps.onSelectionChanged !== newProps.onSelectionChanged) {
            this.initSelectionHandler(newProps.onSelectionChanged);
        }

        if (!oldProps || oldProps.selected !== newProps.selected) {
            this.setSelection(newProps.selected);
        }

        return this.selectionModel;
    }

    private initSelectionHandler(onSelectionChanged?: (ids: string[]) => void): void {
        if (!onSelectionChanged) {
            this.signalStore.set(this.owner, this.selectionModel, "selection-changed", null);
            return;
        }

        this.handleSelectionChange = () => {
            onSelectionChanged(this.getSelection());
        };

        this.signalStore.set(this.owner, this.selectionModel, "selection-changed", this.handleSelectionChange);
    }

    private createSelectionModel(mode: Gtk.SelectionMode | undefined, model: Gio.ListModel): SelectionModel {
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

    private setSelection(ids?: string[]): void {
        this.pendingSelection = ids ?? null;
        this.selectionAction.schedule();
    }

    private applySelection(): void {
        const ids = this.pendingSelection;
        const nItems = this.getItemCount();

        this.pendingSelection = null;

        const selected = ids ? this.resolveSelectionIndices(ids) : new Gtk.Bitset();
        const mask = Gtk.Bitset.newRange(0, nItems);

        if (this.selectionModel instanceof Gtk.SingleSelection) {
            const position = selected.getSize() > 0 ? selected.getNth(0) : Gtk.INVALID_LIST_POSITION;
            (this.selectionModel as Gtk.SingleSelection).setSelected(position);
        } else {
            this.selectionModel.setSelection(selected, mask);
        }
    }
}
