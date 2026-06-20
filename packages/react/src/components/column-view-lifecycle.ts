import * as Gtk from "@gtkx/gi/gtk";
import type { BoundItem } from "../reconciler/bound-item.js";
import { scheduleFlush } from "../reconciler/commit-flush.js";
import { findInListModel, listModelItems } from "../reconciler/list-model-iteration.js";
import type { SignalStore } from "../reconciler/signal-store.js";
import type { ColumnController } from "./column-controller.js";

export interface ColumnViewSignalOwner {
    signalStore: SignalStore;
}

export type SortChangeCallback = ((column: string | null, order: Gtk.SortType) => void) | null | undefined;

export interface ColumnViewHost {
    isUncontrolled(): boolean;
    isDetached(): boolean;
    assignModelToWidget(): void;
    assignUncontrolledModelToWidget(): void;
    applySelection(): void;
    applySelectedId(): void;
    scheduleBoundItemsUpdate(): void;
    getSortColumn(): string | null | undefined;
    getSortOrder(): Gtk.SortType | null | undefined;
    getOnSortChanged(): SortChangeCallback;
}

export class ColumnViewLifecycle {
    private columns = new Set<ColumnController>();
    private modelAssigned = false;
    private owner: ColumnViewSignalOwner;
    private columnView: Gtk.ColumnView;
    private host: ColumnViewHost;

    constructor(owner: ColumnViewSignalOwner, columnView: Gtk.ColumnView, host: ColumnViewHost) {
        this.owner = owner;
        this.columnView = columnView;
        this.host = host;
    }

    public addColumn(column: ColumnController): void {
        this.columns.add(column);
    }

    public removeColumn(column: ColumnController): void {
        this.columns.delete(column);
    }

    public clearColumns(): void {
        this.columns.clear();
    }

    private finishAttach(): void {
        if (this.modelAssigned) return;
        this.modelAssigned = true;
        if (this.host.isUncontrolled()) {
            this.host.assignUncontrolledModelToWidget();
            return;
        }
        this.host.assignModelToWidget();
        this.host.applySelection();
        this.host.applySelectedId();
    }

    public scheduleSettle(): void {
        if (this.host.isDetached()) return;
        scheduleFlush(this.settle);
    }

    public settle = (): void => {
        if (this.host.isDetached()) return;
        const modelWasAssigned = this.modelAssigned;
        this.finishAttach();
        if (modelWasAssigned) this.relayoutColumns();
        this.applySortColumn();
        this.host.scheduleBoundItemsUpdate();
    };

    private relayoutColumns(): void {
        const ordered: Gtk.ColumnViewColumn[] = [];
        for (const column of listModelItems(this.columnView.getColumns())) {
            if (column instanceof Gtk.ColumnViewColumn) ordered.push(column);
        }
        for (const column of ordered) this.columnView.removeColumn(column);
        ordered.forEach((column, index) => {
            this.columnView.insertColumn(index, column);
        });
    }

    public applySortColumn(): void {
        const sortColumn = this.host.getSortColumn();
        if (sortColumn === null || sortColumn === undefined) {
            this.columnView.sortByColumn(null, Gtk.SortType.ASCENDING);
            return;
        }
        const column = this.findColumnById(sortColumn);
        if (column) {
            this.columnView.sortByColumn(column, this.host.getSortOrder() ?? Gtk.SortType.ASCENDING);
        }
    }

    private findColumnById(id: string): Gtk.ColumnViewColumn | null {
        return findInListModel(
            this.columnView.getColumns(),
            (obj): obj is Gtk.ColumnViewColumn => obj instanceof Gtk.ColumnViewColumn && obj.getId() === id,
        );
    }

    public connectSortSignal(): void {
        const sorter = this.columnView.getSorter();
        if (!sorter) return;

        const onSortChanged = this.host.getOnSortChanged();
        const handler = onSortChanged
            ? () => {
                  const cvSorter = this.columnView.getSorter();
                  if (!(cvSorter instanceof Gtk.ColumnViewSorter)) {
                      onSortChanged(null, Gtk.SortType.ASCENDING);
                      return;
                  }
                  const primaryColumn = cvSorter.getPrimarySortColumn();
                  const primaryOrder = cvSorter.getPrimarySortOrder();
                  const columnId = primaryColumn?.getId() ?? null;
                  onSortChanged(columnId, primaryOrder);
              }
            : undefined;

        this.owner.signalStore.set({ owner: this.owner, obj: sorter, signal: "changed", handler, blockable: false });
    }

    public collectBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const items: BoundItem[] = [];
        for (const column of this.columns) {
            items.push(...column.collectBoundItems(resolveItem));
        }
        return items;
    }
}
