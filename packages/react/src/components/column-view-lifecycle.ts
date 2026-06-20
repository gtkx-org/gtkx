import * as Gtk from "@gtkx/gi/gtk";
import type { BoundItem } from "../reconciler/bound-item.js";
import { scheduleFlush } from "../reconciler/commit-flush.js";
import { findInListModel, listModelItems } from "../reconciler/list-model-iteration.js";
import type { SignalStore } from "../reconciler/signal-store.js";
import type { ColumnController } from "./column-controller.js";

/** A `SignalStore` paired with the stable key it dedupes the sort handler under. */
export interface ColumnViewSignalOwner {
    /** The store the lifecycle connects and clears its sort handler on. */
    readonly signalStore: SignalStore;
}

/** Fired when the column view's sort column or order changes. */
export type SortChangeCallback = ((column: string | null, order: Gtk.SortType) => void) | null | undefined;

/**
 * The slice of the list controller the column-view lifecycle drives back:
 * controlled-sort prop access, the detached/uncontrolled flags, model and
 * selection (re)assignment, and bound-item scheduling. Matched structurally so
 * this module never imports the concrete controller.
 */
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

/**
 * Owns the `Gtk.ColumnView`-only state and behavior of a list controller: the
 * registered column controllers, the deferred model assignment, the column
 * settle/relayout after column mutations, the controlled sort column, and the
 * column cells collected as portals.
 *
 * The list controller instantiates one only when its widget is a column view,
 * so every method works against a constructor-narrowed `Gtk.ColumnView` with no
 * per-call widget-kind re-checks.
 */
export class ColumnViewLifecycle {
    private readonly columns = new Set<ColumnController>();
    private modelAssigned = false;

    /**
     * @param owner - The signal owner the sort handler is keyed under.
     * @param columnView - The backing column view this lifecycle drives.
     * @param host - The list-controller callbacks the lifecycle drives back.
     */
    constructor(
        private readonly owner: ColumnViewSignalOwner,
        private readonly columnView: Gtk.ColumnView,
        private readonly host: ColumnViewHost,
    ) {}

    /** Registers a column controller so the lifecycle collects its cells. */
    public addColumn(column: ColumnController): void {
        this.columns.add(column);
    }

    /** Unregisters a column controller. */
    public removeColumn(column: ColumnController): void {
        this.columns.delete(column);
    }

    /** Drops every column registration when the list controller disposes. */
    public clearColumns(): void {
        this.columns.clear();
    }

    /**
     * Assigns the model and applies the initial selection once the columns have
     * been inserted.
     *
     * A column view builds and lays out its cells from its model. Assigning the
     * model while the view still has no columns, then inserting the columns,
     * makes GTK rebuild and recycle those cells mid-insertion, disposing cell
     * widgets that still reference a column and measuring already-freed ones.
     * Deferring the model until the columns are in place builds the cells once,
     * against the final column set, so no cell is recycled during insertion.
     */
    public finishAttach(): void {
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

    /**
     * Schedules the settle work to run once after every column mutation of the
     * current commit applies. The reconciler inserts and removes columns during
     * the commit's freeze window; queuing the settle through the commit flush
     * (deduped by identity) collapses many column mutations into one settle that
     * sees the final column set.
     */
    public scheduleSettle(): void {
        if (this.host.isDetached()) return;
        scheduleFlush(this.settle);
    }

    /** Settles the column view after its columns and model are in place. */
    public settle = (): void => {
        if (this.host.isDetached()) return;
        const modelWasAssigned = this.modelAssigned;
        this.finishAttach();
        if (modelWasAssigned) this.relayoutColumns();
        this.applySortColumn();
        this.host.scheduleBoundItemsUpdate();
    };

    /**
     * Re-inserts every live column in its current order so the column view
     * rebuilds each already-realized row's cells in column order.
     *
     * `Gtk.ColumnView.insertColumn` appends a newly inserted column's cells to the
     * visual end of rows that GTK has already realized, leaving the cells out of
     * logical column order. Removing then re-inserting the whole column set forces
     * GTK to lay every row's cells out in the columns' order. It runs only on a
     * settle after the model is assigned, when realized cells exist; the initial
     * settle builds the cells once against the final column set and needs no
     * relayout.
     */
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

    /**
     * Applies the controlled sort column after columns settle, so the `id`
     * lookup against the column view's live column list resolves.
     */
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

    /** Connects the column view sorter's `changed` signal to `onSortChanged`. */
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

    /** Collects the bound cells of every registered column as portals. */
    public collectBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const items: BoundItem[] = [];
        for (const column of this.columns) {
            items.push(...column.collectBoundItems(resolveItem));
        }
        return items;
    }
}
