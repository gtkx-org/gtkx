import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import type { ColumnViewColumnProps } from "../../jsx.js";
import type { BoundItem } from "../../nodes/internal/bound-item.js";
import { connectFactoryLifecycle, UNBOUND_POSITION } from "../../nodes/internal/list-factory.js";
import type { ListController } from "./list-controller.js";
import { buildMenuModel } from "./menu-model.js";

/**
 * Drives one `Gtk.ColumnViewColumn` from the `<GtkColumnViewColumn>` component.
 *
 * It owns the real `Gtk.ColumnViewColumn`, its cell `Gtk.SignalListItemFactory`,
 * the per-column header menu (`Gio.Menu` plus a `Gio.SimpleActionGroup` keyed by
 * the column id), and the bound cells the parent list controller collects into
 * portals. The component constructs the controller, attaches it to the column
 * view, applies prop changes, and disposes it on unmount.
 */
export class ColumnController {
    private readonly column: Gtk.ColumnViewColumn;
    private readonly columnFactory: Gtk.SignalListItemFactory;
    private readonly containers = new Map<Gtk.ListItem, number>();
    private readonly containerKeys = new Map<Gtk.ListItem, string>();
    private readonly actionGroup = new Gio.SimpleActionGroup();
    private disposeMenu: (() => void) | null = null;
    private attachedView: Gtk.ColumnView | null = null;

    /**
     * @param list - The parent list controller this column collects cells for.
     * @param props - The column's initial props.
     */
    constructor(
        private readonly list: ListController,
        private props: ColumnViewColumnProps,
    ) {
        this.columnFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.columnFactory, {
            containers: this.containers,
            containerKeys: this.containerKeys,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.list.queueBoundItemsUpdate(),
            onSetup: (item) => {
                const placeholder = new Gtk.Box();
                const { width, height } = this.list.getEstimatedItemSize();
                placeholder.setSizeRequest(width, height);
                item.setChild(placeholder);
            },
        });
        this.column = Gtk.ColumnViewColumn.new(props.title, this.columnFactory);
        this.column.setId(props.id);
        if (props.expand !== undefined) this.column.setExpand(props.expand);
        if (props.resizable !== undefined) this.column.setResizable(props.resizable);
        if (props.fixedWidth !== undefined) this.column.setFixedWidth(props.fixedWidth);
        if (props.visible !== undefined) this.column.setVisible(props.visible);
        if (props.sortable) this.column.setSorter(new Gtk.CustomSorter());
        this.updateHeaderMenu();
        this.list.addColumn(this);
    }

    /** The backing `Gtk.ColumnViewColumn`. */
    public getColumn(): Gtk.ColumnViewColumn {
        return this.column;
    }

    /**
     * Inserts this column into `columnView` at `position` and installs its
     * header-menu action group under the column id.
     */
    public attachTo(columnView: Gtk.ColumnView, position: number): void {
        columnView.insertActionGroup(this.props.id, this.actionGroup);
        columnView.insertColumn(position, this.column);
        this.attachedView = columnView;
    }

    /** Moves this column to `position` within `columnView` without re-installing actions. */
    public moveWithin(columnView: Gtk.ColumnView, position: number): void {
        columnView.removeColumn(this.column);
        columnView.insertColumn(position, this.column);
        this.attachedView = columnView;
    }

    /**
     * Removes this column from `columnView` and uninstalls its action group.
     * A no-op when the column is no longer attached, so a removal and an unmount
     * disposal cannot double-remove the same column.
     */
    public detachFrom(columnView: Gtk.ColumnView): void {
        if (this.attachedView !== columnView) return;
        columnView.removeColumn(this.column);
        columnView.insertActionGroup(this.props.id, null);
        this.attachedView = null;
    }

    /** Applies a column prop change, refreshing its header menu and cells. */
    public update(oldProps: ColumnViewColumnProps, newProps: ColumnViewColumnProps): void {
        this.props = newProps;
        if (oldProps.title !== newProps.title) this.column.setTitle(newProps.title);
        if (oldProps.expand !== newProps.expand) this.column.setExpand(newProps.expand ?? false);
        if (oldProps.resizable !== newProps.resizable) this.column.setResizable(newProps.resizable ?? false);
        if (oldProps.fixedWidth !== newProps.fixedWidth) this.column.setFixedWidth(newProps.fixedWidth ?? -1);
        if (oldProps.visible !== newProps.visible) this.column.setVisible(newProps.visible ?? true);
        if (oldProps.sortable !== newProps.sortable) {
            this.column.setSorter(newProps.sortable ? new Gtk.CustomSorter() : null);
        }
        if (oldProps.renderCell !== newProps.renderCell) this.list.scheduleBoundItemsUpdate();
        if (oldProps.menuEntries !== newProps.menuEntries) this.updateHeaderMenu();
    }

    /**
     * Removes the column from its column view, releases its header menu, and
     * unregisters it from the parent list controller, leaving no column behind
     * when only this column unmounts while the column view stays mounted.
     */
    public dispose(): void {
        if (this.attachedView) this.detachFrom(this.attachedView);
        this.column.setHeaderMenu(null);
        this.disposeMenu?.();
        this.disposeMenu = null;
        this.list.removeColumn(this);
    }

    /** Collects this column's currently-bound cells as portals. */
    public collectBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const { renderCell } = this.props;
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

    private updateHeaderMenu(): void {
        this.disposeMenu?.();
        this.disposeMenu = null;

        const entries = this.props.menuEntries ?? [];
        if (entries.length === 0) {
            this.column.setHeaderMenu(null);
            return;
        }

        const built = buildMenuModel(entries, {
            actionMap: this.actionGroup,
            prefix: this.props.id,
            application: null,
        });
        this.disposeMenu = built.dispose;
        this.column.setHeaderMenu(built.menu.getNItems() > 0 ? built.menu : null);
    }
}
