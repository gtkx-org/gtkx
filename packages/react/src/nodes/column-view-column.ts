import * as Gtk from "@gtkx/ffi/gtk";
import type { ColumnViewColumnProps } from "../jsx.js";
import type { Container } from "../types.js";
import { ListItemRenderer } from "./internal/list-item-renderer.js";
import type { ListStore } from "./internal/list-store.js";
import { VirtualNode } from "./virtual.js";

type Props = Partial<ColumnViewColumnProps>;

export class ColumnViewColumnNode extends VirtualNode<Props> {
    column: Gtk.ColumnViewColumn;
    private itemRenderer: ListItemRenderer;

    constructor(typeName: string, props: Props, container: undefined, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.itemRenderer = new ListItemRenderer(this.signalStore);
        this.column = new Gtk.ColumnViewColumn();
        this.column.setFactory(this.itemRenderer.getFactory());
    }

    public override unmount(): void {
        this.itemRenderer.dispose();
        super.unmount();
    }

    public setStore(model: ListStore | null): void {
        this.itemRenderer.setStore(model);
    }

    public setEstimatedRowHeight(height: number | null): void {
        this.itemRenderer.setEstimatedItemHeight(height);
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        if (!oldProps || oldProps.renderCell !== newProps.renderCell) {
            if (newProps.renderCell) {
                this.itemRenderer.setRenderFn(newProps.renderCell);
            }
        }

        if (!oldProps || oldProps.title !== newProps.title) {
            this.column.setTitle(newProps.title ?? "");
        }

        if (!oldProps || oldProps.expand !== newProps.expand) {
            this.column.setExpand(newProps.expand ?? false);
        }

        if (!oldProps || oldProps.resizable !== newProps.resizable) {
            this.column.setResizable(newProps.resizable ?? false);
        }

        if (!oldProps || oldProps.fixedWidth !== newProps.fixedWidth) {
            this.column.setFixedWidth(newProps.fixedWidth ?? -1);
        }

        if (!oldProps || oldProps.id !== newProps.id) {
            if (newProps.id) {
                this.column.setId(newProps.id);
            }
        }

        if (!oldProps || oldProps.sortable !== newProps.sortable) {
            if (newProps.sortable) {
                this.column.setSorter(new Gtk.StringSorter());
            } else {
                this.column.setSorter(null);
            }
        }

        super.updateProps(oldProps, newProps);
    }
}
