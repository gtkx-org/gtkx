import * as Gtk from "@gtkx/ffi/gtk";
import type { GridChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

export class GridChildNode extends AttachOnParentVirtualNode<GridChildProps, WidgetNode<Gtk.Grid>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.Grid;
    }

    public override commitUpdate(oldProps: GridChildProps | null, newProps: GridChildProps): void {
        super.commitUpdate(oldProps, newProps);

        const positionChanged =
            hasChanged(oldProps, newProps, "column") ||
            hasChanged(oldProps, newProps, "row") ||
            hasChanged(oldProps, newProps, "columnSpan") ||
            hasChanged(oldProps, newProps, "rowSpan");

        if (positionChanged && this.parent && this.children[0]) {
            this.reinsertAllChildren();
        }
    }

    protected override attachToParent(parent: Gtk.Grid, child: Gtk.Widget): void {
        const column = this.props.column ?? 0;
        const row = this.props.row ?? 0;
        const columnSpan = this.props.columnSpan ?? 1;
        const rowSpan = this.props.rowSpan ?? 1;

        const existingChild = parent.getChildAt(column, row);
        if (existingChild && existingChild !== child) {
            parent.remove(existingChild);
        }

        parent.attach(child, column, row, columnSpan, rowSpan);
    }
}
