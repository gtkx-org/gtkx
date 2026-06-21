import type * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import type { ListModelController } from "./list-model-controller.js";
import type { SignalStore } from "./signal-store.js";

export interface SelectionSignalOwner {
    signalStore: SignalStore;
}

export interface SelectionHost {
    isDropDown(): boolean;
    assignModelToWidget(): void;
    getDropDownSelectionCallback(): ((id: string) => void) | null;
    getMultiSelectionCallback(): ((ids: string[]) => void) | null;
    setDropDownSelected(position: number): void;
    getDropDownSelected(): number;
}

export class SelectionController {
    public selectionModel: Gtk.SingleSelection | Gtk.MultiSelection | Gtk.NoSelection | null = null;

    private owner: SelectionSignalOwner;
    private backingInstance: Gtk.Widget;
    private model: ListModelController;
    private host: SelectionHost;

    constructor(
        owner: SelectionSignalOwner,
        backingInstance: Gtk.Widget,
        model: ListModelController,
        host: SelectionHost,
    ) {
        this.owner = owner;
        this.backingInstance = backingInstance;
        this.model = model;
        this.host = host;
    }

    public setup(selectionMode: Gtk.SelectionMode | null | undefined): void {
        if (this.host.isDropDown()) {
            this.selectionModel = null;
            return;
        }
        this.selectionModel = this.createSelectionModel(selectionMode ?? Gtk.SelectionMode.SINGLE);
    }

    private createSelectionModel(
        selectionMode: Gtk.SelectionMode,
    ): Gtk.SingleSelection | Gtk.MultiSelection | Gtk.NoSelection {
        const baseModel = this.model.getBaseModel();

        if (selectionMode === Gtk.SelectionMode.MULTIPLE) {
            return new Gtk.MultiSelection({ model: baseModel });
        }
        if (selectionMode === Gtk.SelectionMode.NONE) {
            return new Gtk.NoSelection({ model: baseModel });
        }
        const sel = new Gtk.SingleSelection({ model: baseModel });
        sel.setAutoselect(false);
        sel.setCanUnselect(true);
        return sel;
    }

    public assignBaseModel(model: Gio.ListModel): void {
        const sel = this.selectionModel;
        if (!sel) return;
        sel.setModel(model);
    }

    public rebuild(selectionMode: Gtk.SelectionMode | null | undefined): void {
        this.disconnectSelectionSignal();
        this.selectionModel = this.host.isDropDown()
            ? null
            : this.createSelectionModel(selectionMode ?? Gtk.SelectionMode.SINGLE);
        this.host.assignModelToWidget();
        this.connectSelectionSignal();
    }

    private disconnectSelectionSignal(): void {
        if (!this.selectionModel) return;
        this.owner.signalStore.set({
            owner: this.owner,
            obj: this.selectionModel,
            signal: "selection-changed",
        });
    }

    private clearSelection(): void {
        if (this.selectionModel instanceof Gtk.SingleSelection) {
            this.selectionModel.setSelected(Gtk.INVALID_LIST_POSITION);
        } else if (this.selectionModel instanceof Gtk.MultiSelection) {
            this.selectionModel.unselectAll();
        }
    }

    private applySingleSelection(
        model: Gtk.SingleSelection,
        idSet: Set<string>,
        idAtPosition: (string | null)[],
    ): void {
        for (let i = 0; i < idAtPosition.length; i++) {
            const id = idAtPosition[i];
            if (id && idSet.has(id)) {
                model.setSelected(i);
                return;
            }
        }
    }

    private applyMultiSelection(model: Gtk.MultiSelection, idSet: Set<string>, idAtPosition: (string | null)[]): void {
        model.unselectAll();
        for (let i = 0; i < idAtPosition.length; i++) {
            const id = idAtPosition[i];
            if (id && idSet.has(id)) {
                model.selectItem(i, false);
            }
        }
    }

    public applySelection(ids: string[] | null): void {
        if (!this.selectionModel || this.host.isDropDown()) return;

        if (!ids || ids.length === 0) {
            this.clearSelection();
            return;
        }

        const idSet = new Set(ids);
        const idAtPosition = this.model.resolveIdsAtPositions(this.selectionModel.getNItems());
        if (this.selectionModel instanceof Gtk.SingleSelection) {
            this.applySingleSelection(this.selectionModel, idSet, idAtPosition);
        } else if (this.selectionModel instanceof Gtk.MultiSelection) {
            this.applyMultiSelection(this.selectionModel, idSet, idAtPosition);
        }
    }

    public applySelectedId(id: string | null | undefined): void {
        if (!this.host.isDropDown()) return;
        if (id === undefined) return;
        if (id === null) {
            this.host.setDropDownSelected(Gtk.INVALID_LIST_POSITION);
            return;
        }

        const flatItems = this.model.collectFlatItems();
        for (let i = 0; i < flatItems.length; i++) {
            if (flatItems[i]?.id === id) {
                this.host.setDropDownSelected(i);
                return;
            }
        }
    }

    private collectTreeSelectionIds(treeModel: Gtk.TreeListModel, selection: Gtk.Bitset, nItems: number): string[] {
        const ids: string[] = [];
        for (let i = 0; i < nItems; i++) {
            if (!selection.contains(i)) continue;
            const row = treeModel.getRow(i);
            const item = row ? this.model.resolveTreeItem(row) : null;
            if (item) ids.push(item.id);
        }
        return ids;
    }

    private collectFlatSelectionIds(selection: Gtk.Bitset, nItems: number): string[] {
        const ids: string[] = [];
        const flatItems = this.model.collectFlatItems();
        for (let i = 0; i < nItems; i++) {
            if (!selection.contains(i)) continue;
            const item = flatItems[i];
            if (item) ids.push(item.id);
        }
        return ids;
    }

    private buildDropDownSelectionHandler(onSelectionChanged: (id: string) => void): () => void {
        return () => {
            const position = this.host.getDropDownSelected();
            const flatItems = this.model.collectFlatItems();
            const item = flatItems[position];
            if (item) {
                onSelectionChanged(item.id);
            }
        };
    }

    private buildMultiSelectionHandler(onSelectionChanged: (ids: string[]) => void): () => void {
        return () => {
            const selection = this.selectionModel?.getSelection();
            if (!selection) return;
            const nItems = this.selectionModel?.getNItems() ?? 0;
            const treeModel = this.model.treeModel;
            const ids = treeModel
                ? this.collectTreeSelectionIds(treeModel, selection, nItems)
                : this.collectFlatSelectionIds(selection, nItems);
            onSelectionChanged(ids);
        };
    }

    public connectSelectionSignal(): void {
        if (this.host.isDropDown()) {
            const callback = this.host.getDropDownSelectionCallback();
            const handler = callback ? this.buildDropDownSelectionHandler(callback) : undefined;
            this.owner.signalStore.set({
                owner: this.owner,
                obj: this.backingInstance,
                signal: "notify::selected",
                handler,
            });
            return;
        }

        if (!this.selectionModel) return;

        const callback = this.host.getMultiSelectionCallback();
        const handler = callback ? this.buildMultiSelectionHandler(callback) : undefined;

        this.owner.signalStore.set({
            owner: this.owner,
            obj: this.selectionModel,
            signal: "selection-changed",
            handler,
            blockable: false,
        });
    }
}
