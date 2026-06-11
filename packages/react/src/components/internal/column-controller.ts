import * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import type { BoundItem } from "../../nodes/internal/bound-item.js";
import { connectFactoryLifecycle, UNBOUND_POSITION } from "../../nodes/internal/list-factory.js";

const UNREGISTERED_ITEM_SIZE = { width: -1, height: -1 } as const;

/**
 * The structural surface of the list controller a column registers against:
 * column membership, bound-item refresh scheduling, and the placeholder cell
 * size. Declared here so the column controller never imports the list
 * controller's module.
 */
export interface ColumnHost {
    /** Adds the column to the host's settle and collection passes. */
    addColumn(column: ColumnController): void;
    /** Removes the column from the host. */
    removeColumn(column: ColumnController): void;
    /** Queues a bound-item refresh outside a commit. */
    queueBoundItemsUpdate(): void;
    /** Schedules a bound-item refresh aligned with the current commit. */
    scheduleBoundItemsUpdate(): void;
    /** The estimated per-item size used to seed placeholder cells. */
    getEstimatedItemSize(): { width: number; height: number };
}

/** Renders one bound cell of the column from its row value. */
type CellRenderer = (item: unknown) => ReactNode;

/**
 * Drives one `Gtk.ColumnViewColumn` element of a `<GtkColumnView>`.
 *
 * It owns the column's cell `Gtk.SignalListItemFactory` and the bound cells
 * the parent list controller collects into portals. The
 * `<GtkColumnViewColumn>` component constructs the controller alongside its
 * render, passes the factory to the column intrinsic as a regular construct
 * prop, registers the controller on the enclosing column view's list
 * controller (shared through the column-view context), routes `renderCell`
 * changes through {@link setRenderCell}, and tears it down on unmount. The
 * column header menu is a native `<GMenu>` placed in the column's
 * `headerMenu` slot, outside the controller.
 */
export class ColumnController {
    /** The cell factory the backing column is constructed with. */
    public readonly factory: Gtk.SignalListItemFactory;
    private readonly containers = new Map<Gtk.ListItem, number>();
    private readonly containerKeys = new Map<Gtk.ListItem, string>();
    private list: ColumnHost | null = null;
    private renderCell: CellRenderer | null = null;

    /**
     * Builds the cell factory and connects its lifecycle. The factory's
     * callbacks read the currently-registered list controller, so a column
     * built before its view settles seeds cells with a default placeholder
     * size and defers bound-item refreshes until registration.
     */
    public constructor() {
        this.factory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.factory, {
            containers: this.containers,
            containerKeys: this.containerKeys,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.list?.queueBoundItemsUpdate(),
            onSetup: (item) => {
                const placeholder = new Gtk.Box();
                const { width, height } = this.list?.getEstimatedItemSize() ?? UNREGISTERED_ITEM_SIZE;
                placeholder.setSizeRequest(width, height);
                item.setChild(placeholder);
            },
        });
    }

    /**
     * Registers the controller on `list` so it collects this column's cells.
     * Idempotent: re-registering on the same list is a no-op.
     *
     * @param list - The enclosing column view's list controller.
     */
    public register(list: ColumnHost): void {
        if (this.list === list) return;
        this.list = list;
        list.addColumn(this);
    }

    /**
     * Unregisters the controller from its list. Idempotent: a no-op when not
     * registered.
     */
    public unregister(): void {
        if (!this.list) return;
        this.list.removeColumn(this);
        this.list = null;
    }

    /**
     * Updates the column's cell renderer, refreshing its bound cells when the
     * renderer changes.
     *
     * @param renderCell - The current `renderCell` prop, or `null`.
     */
    public setRenderCell(renderCell: CellRenderer | null): void {
        if (this.renderCell === renderCell) return;
        this.renderCell = renderCell;
        this.list?.scheduleBoundItemsUpdate();
    }

    /** Clears the column's bound-cell bookkeeping when its element unmounts. */
    public teardown(): void {
        this.containers.clear();
        this.containerKeys.clear();
    }

    /** Collects this column's currently-bound cells as portals. */
    public collectBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const renderCell = this.renderCell;
        if (!renderCell) return [];

        const items: BoundItem[] = [];

        for (const [container, position] of this.containers) {
            if (position === UNBOUND_POSITION) continue;

            const key = this.containerKeys.get(container);
            if (!key) continue;

            const value = resolveItem(position);
            if (value === undefined || value === null) continue;
            items.push([renderCell(value), container, key]);
        }

        return items;
    }
}
