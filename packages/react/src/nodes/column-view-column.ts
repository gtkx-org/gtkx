import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import type { ColumnViewColumnProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { BackingInstance } from "../types.js";
import type { BoundItem } from "./internal/bound-item.js";
import { connectFactoryLifecycle, UNBOUND_POSITION } from "./internal/list-factory.js";
import { MenuChildController } from "./internal/menu-child.js";
import { hasChanged } from "./internal/props.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

/**
 * The subset of a parent list node that a bound column drives to refresh its
 * cells. Matched structurally so the column does not depend on the concrete
 * list node, which would close a reconciler import cycle.
 */
type ParentBoundItemsUpdater = {
    scheduleBoundItemsUpdate(): void;
    queueBoundItemsUpdate(): void;
};

export class ColumnViewColumnNode extends VirtualNode<ColumnViewColumnProps, WidgetNode, MenuNode> {
    private column: Gtk.ColumnViewColumn | null = null;
    private columnFactory: Gtk.SignalListItemFactory | null = null;
    private readonly containers = new Map<Gtk.ListItem, number>();
    private readonly containerKeys = new Map<Gtk.ListItem, string>();
    private readonly menuController: MenuChildController;
    private readonly actionGroup: Gio.SimpleActionGroup;

    constructor(typeName: string, props: ColumnViewColumnProps, container: undefined, rootContainer: BackingInstance) {
        super(typeName, props, container, rootContainer);
        this.actionGroup = new Gio.SimpleActionGroup();
        const menu = new MenuModel({ type: "root", props: {}, rootContainer, actionMap: this.actionGroup });
        menu.setActionMap(this.actionGroup, props.id);
        this.menuController = new MenuChildController(menu);
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof MenuNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.backingInstance instanceof Gtk.ColumnView;
    }

    public override finalizeInitialChildren(props: ColumnViewColumnProps): boolean {
        this.setupFactory();
        this.setupColumn(props);
        this.updateHeaderMenu();
        return false;
    }

    public override commitUpdate(oldProps: ColumnViewColumnProps | null, newProps: ColumnViewColumnProps): void {
        super.commitUpdate(oldProps, newProps);
        if (oldProps === null) return;
        this.applyColumnProps(oldProps, newProps);
    }

    public override appendChild(child: MenuNode): void {
        this.menuController.appendChild(child);
        this.updateHeaderMenu();
    }

    public override insertBefore(child: MenuNode, before: MenuNode): void {
        this.menuController.insertBefore(child, before);
        this.updateHeaderMenu();
    }

    public override removeChild(child: MenuNode): void {
        this.menuController.removeChild(child);
        this.updateHeaderMenu();
    }

    public getColumn(): Gtk.ColumnViewColumn {
        if (!this.column) throw new Error("ColumnViewColumn not initialized");
        return this.column;
    }

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

    public installActionGroup(widget: Gtk.Widget): void {
        widget.insertActionGroup(this.props.id, this.actionGroup);
    }

    public uninstallActionGroup(widget: Gtk.Widget): void {
        widget.insertActionGroup(this.props.id, null);
    }

    private setupFactory(): void {
        this.columnFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.columnFactory, {
            containers: this.containers,
            containerKeys: this.containerKeys,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.boundItemsParent?.queueBoundItemsUpdate(),
            onSetup: (item) => {
                const placeholder = new Gtk.Box();
                const { width, height } = this.getParentEstimatedItemSize();
                placeholder.setSizeRequest(width, height);
                item.setChild(placeholder);
            },
        });
    }

    private setupColumn(props: ColumnViewColumnProps): void {
        this.column = Gtk.ColumnViewColumn.new(props.title, this.columnFactory);
        this.column.setId(props.id);

        if (props.expand !== undefined) this.column.setExpand(props.expand);
        if (props.resizable !== undefined) this.column.setResizable(props.resizable);
        if (props.fixedWidth !== undefined) this.column.setFixedWidth(props.fixedWidth);
        if (props.visible !== undefined) this.column.setVisible(props.visible);
        if (props.sortable) this.column.setSorter(new Gtk.CustomSorter());
    }

    private applyColumnProps(oldProps: ColumnViewColumnProps, newProps: ColumnViewColumnProps): void {
        if (!this.column) return;

        if (hasChanged(oldProps, newProps, "title")) this.column.setTitle(newProps.title);
        if (hasChanged(oldProps, newProps, "expand")) this.column.setExpand(newProps.expand ?? false);
        if (hasChanged(oldProps, newProps, "resizable")) this.column.setResizable(newProps.resizable ?? false);
        if (hasChanged(oldProps, newProps, "fixedWidth")) this.column.setFixedWidth(newProps.fixedWidth ?? -1);
        if (hasChanged(oldProps, newProps, "visible")) this.column.setVisible(newProps.visible ?? true);
        if (hasChanged(oldProps, newProps, "sortable")) {
            this.column.setSorter(newProps.sortable ? new Gtk.CustomSorter() : null);
        }
        if (hasChanged(oldProps, newProps, "renderCell")) this.boundItemsParent?.scheduleBoundItemsUpdate();
    }

    private updateHeaderMenu(): void {
        if (!this.column) return;
        const menu = this.menuController.menu.getMenu();
        this.column.setHeaderMenu(menu.getNItems() > 0 ? menu : null);
    }

    private getParentEstimatedItemSize(): { width: number; height: number } {
        if (this.parent && "getEstimatedItemSize" in this.parent) {
            return (
                this.parent as { getEstimatedItemSize(): { width: number; height: number } }
            ).getEstimatedItemSize();
        }
        return { width: -1, height: -1 };
    }

    private get boundItemsParent(): ParentBoundItemsUpdater | null {
        const candidate = this.parent as Partial<ParentBoundItemsUpdater> | null | undefined;
        if (
            typeof candidate?.scheduleBoundItemsUpdate === "function" &&
            typeof candidate?.queueBoundItemsUpdate === "function"
        ) {
            return candidate as ParentBoundItemsUpdater;
        }
        return null;
    }
}
