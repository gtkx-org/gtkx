import * as Gtk from "@gtkx/ffi/gtk";
import type { ColumnViewColumnProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { ListItemRenderer } from "./internal/list-item-renderer.js";
import { hasChanged } from "./internal/props.js";
import type { TreeStore } from "./internal/tree-store.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class ColumnViewColumnNode extends VirtualNode<ColumnViewColumnProps, WidgetNode<Gtk.ColumnView>, never> {
    public override isValidChild(_child: Node): boolean {
        return false;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.ColumnView;
    }
    private column: Gtk.ColumnViewColumn;
    private itemRenderer: ListItemRenderer;

    constructor(typeName: string, props: ColumnViewColumnProps, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.itemRenderer = new ListItemRenderer(this.signalStore);
        this.column = new Gtk.ColumnViewColumn();
        this.column.setFactory(this.itemRenderer.getFactory());
    }

    public override commitUpdate(oldProps: ColumnViewColumnProps | null, newProps: ColumnViewColumnProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        this.itemRenderer.dispose();
        super.detachDeletedInstance();
    }

    public getColumn(): Gtk.ColumnViewColumn {
        return this.column;
    }

    public setStore(model: TreeStore | null): void {
        this.itemRenderer.setStore(model);
    }

    public setEstimatedRowHeight(height: number | null): void {
        this.itemRenderer.setEstimatedItemHeight(height);
    }

    private applyOwnProps(oldProps: ColumnViewColumnProps | null, newProps: ColumnViewColumnProps): void {
        if (hasChanged(oldProps, newProps, "renderCell")) {
            this.itemRenderer.setRenderFn(newProps.renderCell);
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
            this.column.setId(newProps.id);
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
