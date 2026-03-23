import { getNativeId } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ColumnViewColumnProps, ListItem } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import type { BoundItem } from "./internal/bound-item.js";
import { hasChanged } from "./internal/props.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

const UNBOUND_POSITION = -1;

export class ColumnViewColumnNode extends VirtualNode<ColumnViewColumnProps, WidgetNode, MenuNode> {
    private column: Gtk.ColumnViewColumn | null = null;
    private columnFactory: Gtk.SignalListItemFactory | null = null;
    private containers = new Map<Gtk.ListItem, number>();
    private containerKeys = new Map<Gtk.ListItem, string>();
    private menu: MenuModel;
    private actionGroup: Gio.SimpleActionGroup;

    constructor(typeName: string, props: ColumnViewColumnProps, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.actionGroup = new Gio.SimpleActionGroup();
        this.menu = new MenuModel("root", {}, rootContainer, this.actionGroup);
        this.menu.setActionMap(this.actionGroup, props.id);
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof MenuNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.ColumnView;
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
        this.menu.appendChild(child);
        this.updateHeaderMenu();
    }

    public override insertBefore(child: MenuNode, before: MenuNode): void {
        this.menu.insertBefore(child, before);
        this.updateHeaderMenu();
    }

    public override removeChild(child: MenuNode): void {
        this.menu.removeChild(child);
        this.updateHeaderMenu();
    }

    public override detachDeletedInstance(): void {
        super.detachDeletedInstance();
    }

    public getColumn(): Gtk.ColumnViewColumn {
        if (!this.column) throw new Error("ColumnViewColumn not initialized");
        return this.column;
    }

    public collectBoundItems(flatItems: ListItem[]): BoundItem[] {
        const { renderCell } = this.props;
        if (!renderCell) return [];

        const items: BoundItem[] = [];

        for (const [container, position] of this.containers) {
            if (position === UNBOUND_POSITION) continue;

            const key = this.containerKeys.get(container);
            if (!key) continue;

            const item = flatItems[position];
            if (!item) continue;
            const content = renderCell(item.value);
            items.push([content, container, key]);
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

        this.columnFactory.connect("setup", (_self: GObject.Object, obj: GObject.Object) => {
            const listItem = obj as unknown as Gtk.ListItem;
            const key = String(getNativeId(listItem.handle));
            const placeholder = new Gtk.Box();
            const { width, height } = this.getParentEstimatedItemSize();
            placeholder.setSizeRequest(width, height);
            listItem.setChild(placeholder);
            this.containers.set(listItem, UNBOUND_POSITION);
            this.containerKeys.set(listItem, key);
        });

        this.columnFactory.connect("bind", (_self: GObject.Object, obj: GObject.Object) => {
            const listItem = obj as unknown as Gtk.ListItem;
            this.containers.set(listItem, listItem.getPosition());
            this.scheduleParentUpdate();
        });

        this.columnFactory.connect("unbind", (_self: GObject.Object, obj: GObject.Object) => {
            const listItem = obj as unknown as Gtk.ListItem;
            this.containers.set(listItem, UNBOUND_POSITION);
            this.scheduleParentUpdate();
        });

        this.columnFactory.connect("teardown", (_self: GObject.Object, obj: GObject.Object) => {
            const listItem = obj as unknown as Gtk.ListItem;
            this.containers.delete(listItem);
            this.containerKeys.delete(listItem);
            listItem.setChild(null);
        });
    }

    private setupColumn(props: ColumnViewColumnProps): void {
        this.column = new Gtk.ColumnViewColumn(props.title, this.columnFactory);
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
        if (hasChanged(oldProps, newProps, "renderCell")) this.scheduleParentUpdate();
    }

    private updateHeaderMenu(): void {
        if (!this.column) return;
        const menu = this.menu.getMenu();
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

    private scheduleParentUpdate(): void {
        if (
            this.parent &&
            "scheduleBoundItemsUpdate" in this.parent &&
            typeof this.parent.scheduleBoundItemsUpdate === "function"
        ) {
            (this.parent as { scheduleBoundItemsUpdate(): void }).scheduleBoundItemsUpdate();
        }
    }
}
