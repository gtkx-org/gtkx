import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ColumnViewColumnProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { GridItemRenderer } from "./internal/grid-item-renderer.js";
import { ListItemRenderer } from "./internal/list-item-renderer.js";
import type { ListStore } from "./internal/list-store.js";
import { hasChanged } from "./internal/props.js";
import type { TreeStore } from "./internal/tree-store.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class ColumnViewColumnNode extends VirtualNode<ColumnViewColumnProps, WidgetNode<Gtk.ColumnView>, MenuNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof MenuNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.ColumnView;
    }
    private column: Gtk.ColumnViewColumn;
    private treeRenderer: ListItemRenderer | null;
    private flatRenderer: GridItemRenderer | null = null;
    private menu: MenuModel | null = null;
    private actionGroup: Gio.SimpleActionGroup | null = null;
    private columnView: Gtk.ColumnView | null = null;

    constructor(typeName: string, props: ColumnViewColumnProps, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.treeRenderer = new ListItemRenderer(this.signalStore);
        this.column = new Gtk.ColumnViewColumn();
        this.column.setFactory(this.treeRenderer.getFactory());
    }

    public override appendChild(child: MenuNode): void {
        this.initMenu();
        this.menu?.appendChild(child);
    }

    public override insertBefore(child: MenuNode, before: MenuNode): void {
        this.initMenu();
        if (before instanceof MenuNode) {
            this.menu?.insertBefore(child, before);
        } else {
            this.menu?.appendChild(child);
        }
    }

    public override removeChild(child: MenuNode): void {
        this.menu?.removeChild(child);

        if (this.menu && this.menu.getMenu().getNItems() === 0) {
            this.cleanupMenu();
        }
    }

    public override commitUpdate(oldProps: ColumnViewColumnProps | null, newProps: ColumnViewColumnProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        this.cleanupMenu();
        this.treeRenderer?.dispose();
        this.flatRenderer?.dispose();
        super.detachDeletedInstance();
    }

    public getColumn(): Gtk.ColumnViewColumn {
        return this.column;
    }

    public rebindItem(id: string): void {
        this.treeRenderer?.rebindItem(id);
        this.flatRenderer?.rebindItem(id);
    }

    public setStore(model: TreeStore | null): void {
        this.treeRenderer?.setStore(model);
    }

    public setFlatStore(store: ListStore): void {
        if (this.treeRenderer) {
            this.treeRenderer.dispose();
            this.treeRenderer = null;
        }
        if (!this.flatRenderer) {
            this.flatRenderer = new GridItemRenderer(this.signalStore);
            this.flatRenderer.setRenderFn(this.props.renderCell);
            this.column.setFactory(this.flatRenderer.getFactory());
        }
        this.flatRenderer.setStore(store);
    }

    public setEstimatedRowHeight(height: number | null): void {
        this.treeRenderer?.setEstimatedItemHeight(height);
        this.flatRenderer?.setEstimatedItemHeight(height);
    }

    public attachToColumnView(columnView: Gtk.ColumnView): void {
        this.columnView = columnView;

        if (this.actionGroup) {
            this.columnView.insertActionGroup(this.props.id, this.actionGroup);
        }
    }

    public detachFromColumnView(): void {
        if (this.columnView && this.actionGroup) {
            this.columnView.insertActionGroup(this.props.id, null);
        }

        this.columnView = null;
    }

    private initMenu(): void {
        if (this.menu) return;

        this.actionGroup = new Gio.SimpleActionGroup();
        this.menu = new MenuModel("root", {}, this.rootContainer);
        this.menu.setActionMap(this.actionGroup, this.props.id);
        this.column.setHeaderMenu(this.menu.getMenu());

        if (this.columnView) {
            this.columnView.insertActionGroup(this.props.id, this.actionGroup);
        }
    }

    private cleanupMenu(): void {
        if (!this.menu) return;

        this.column.setHeaderMenu(null);

        if (this.columnView && this.actionGroup) {
            this.columnView.insertActionGroup(this.props.id, null);
        }

        this.menu = null;
        this.actionGroup = null;
    }

    private applyOwnProps(oldProps: ColumnViewColumnProps | null, newProps: ColumnViewColumnProps): void {
        if (hasChanged(oldProps, newProps, "renderCell")) {
            this.treeRenderer?.setRenderFn(newProps.renderCell);
            this.flatRenderer?.setRenderFn(newProps.renderCell);
        }

        if (hasChanged(oldProps, newProps, "title")) {
            this.column.setTitle(newProps.title);
        }

        if (hasChanged(oldProps, newProps, "expand")) {
            this.column.setExpand(newProps.expand ?? false);
        }

        if (hasChanged(oldProps, newProps, "resizable")) {
            this.column.setResizable(newProps.resizable ?? false);
        }

        if (hasChanged(oldProps, newProps, "fixedWidth")) {
            this.column.setFixedWidth(newProps.fixedWidth ?? -1);
        }

        if (hasChanged(oldProps, newProps, "id")) {
            if (this.columnView && this.actionGroup && oldProps?.id) {
                this.columnView.insertActionGroup(oldProps.id, null);
                this.columnView.insertActionGroup(newProps.id, this.actionGroup);
            }

            this.column.setId(newProps.id);

            if (oldProps && this.menu && this.actionGroup) {
                this.menu.setActionMap(this.actionGroup, newProps.id);
            }
        }

        if (hasChanged(oldProps, newProps, "visible")) {
            this.column.setVisible(newProps.visible ?? true);
        }

        if (hasChanged(oldProps, newProps, "sortable")) {
            if (newProps.sortable) {
                this.column.setSorter(new Gtk.StringSorter());
            } else {
                this.column.setSorter(null);
            }
        }
    }
}
