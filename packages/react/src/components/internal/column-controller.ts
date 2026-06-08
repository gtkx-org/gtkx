import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import type { ColumnViewColumnProps } from "../../jsx.js";
import type { BoundItem } from "../../nodes/internal/bound-item.js";
import { connectFactoryLifecycle, UNBOUND_POSITION } from "../../nodes/internal/list-factory.js";
import type { ListController } from "./list-controller.js";
import { buildMenuModel } from "./menu-model.js";

const UNREGISTERED_ITEM_SIZE = { width: -1, height: -1 } as const;

/**
 * Drives one `Gtk.ColumnViewColumn` element of a `<GtkColumnView>`.
 *
 * It owns the column's cell `Gtk.SignalListItemFactory`, the per-column header
 * menu (`Gio.Menu` plus a `Gio.SimpleActionGroup` keyed by the column id), and
 * the bound cells the parent list controller collects into portals. The
 * reconciler constructs the controller alongside its backing column during
 * element construction, registers it on the enclosing column view's list
 * controller when the column attaches, applies prop changes through the prop
 * descriptor, and tears it down when the column element is removed.
 */
export class ColumnController {
    private readonly containers = new Map<Gtk.ListItem, number>();
    private readonly containerKeys = new Map<Gtk.ListItem, string>();
    private readonly actionGroup = new Gio.SimpleActionGroup();
    private disposeMenu: (() => void) | null = null;
    private list: ListController | null = null;

    /**
     * Builds the cell factory and the backing `Gtk.ColumnViewColumn`, applies the
     * initial column props, then constructs the controller bound to them.
     *
     * The factory's lifecycle callbacks read the controller's currently-registered
     * list controller, so a column built before it attaches to a column view seeds
     * cells with a default placeholder size and defers bound-item refreshes until
     * registration.
     *
     * @param props - The column's initial props.
     * @returns The controller bound to its constructed column.
     */
    public static build(props: ColumnViewColumnProps): ColumnController {
        const factory = new Gtk.SignalListItemFactory();
        const column = Gtk.ColumnViewColumn.new(props.title, factory);
        const controller = new ColumnController(column, props);
        connectFactoryLifecycle(factory, {
            containers: controller.containers,
            containerKeys: controller.containerKeys,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => controller.list?.queueBoundItemsUpdate(),
            onSetup: (item) => {
                const placeholder = new Gtk.Box();
                const { width, height } = controller.list?.getEstimatedItemSize() ?? UNREGISTERED_ITEM_SIZE;
                placeholder.setSizeRequest(width, height);
                item.setChild(placeholder);
            },
        });
        column.setId(props.id);
        if (props.expand !== undefined) column.setExpand(props.expand);
        if (props.resizable !== undefined) column.setResizable(props.resizable);
        if (props.fixedWidth !== undefined) column.setFixedWidth(props.fixedWidth);
        if (props.visible !== undefined) column.setVisible(props.visible);
        if (props.sortable) column.setSorter(new Gtk.CustomSorter());
        controller.updateHeaderMenu();
        return controller;
    }

    /**
     * @param column - The backing column the cell factory was constructed with.
     * @param props - The column's initial props.
     */
    private constructor(
        private readonly column: Gtk.ColumnViewColumn,
        private props: ColumnViewColumnProps,
    ) {}

    /** The backing `Gtk.ColumnViewColumn`. */
    public getColumn(): Gtk.ColumnViewColumn {
        return this.column;
    }

    /**
     * Registers the controller on `list` so it collects this column's cells, and
     * installs the header-menu action group under the column id on the column
     * view. Idempotent: re-registering on the same list is a no-op.
     *
     * @param list - The enclosing column view's list controller.
     * @param columnView - The column view the action group installs on.
     */
    public register(list: ListController, columnView: Gtk.ColumnView): void {
        if (this.list === list) return;
        this.list = list;
        list.addColumn(this);
        columnView.insertActionGroup(this.props.id, this.actionGroup);
    }

    /**
     * Unregisters the controller from its list and uninstalls the header-menu
     * action group from `columnView`. Idempotent: a no-op when not registered.
     *
     * @param columnView - The column view the action group uninstalls from.
     */
    public unregister(columnView: Gtk.ColumnView): void {
        if (!this.list) return;
        this.list.removeColumn(this);
        this.list = null;
        columnView.insertActionGroup(this.props.id, null);
    }

    /** Requests a bound-item refresh on the registered list, if any. */
    private scheduleBoundItemsUpdate(): void {
        this.list?.scheduleBoundItemsUpdate();
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
        if (oldProps.renderCell !== newProps.renderCell) this.scheduleBoundItemsUpdate();
        if (oldProps.menuEntries !== newProps.menuEntries) this.updateHeaderMenu();
    }

    /**
     * Releases the column's header menu and clears its bound-cell bookkeeping.
     * Called from the column element's teardown when it unmounts.
     */
    public teardown(): void {
        this.column.setHeaderMenu(null);
        this.disposeMenu?.();
        this.disposeMenu = null;
        this.containers.clear();
        this.containerKeys.clear();
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
