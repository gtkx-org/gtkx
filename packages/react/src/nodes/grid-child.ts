import * as Gtk from "@gtkx/gi/gtk";
import type { GridChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { hasChanged } from "./internal/props.js";
import { attachChild } from "./internal/widget.js";
import { WidgetNode } from "./widget.js";

/**
 * Reconciler node for `<GtkGrid.Child>`.
 *
 * Positions a widget within a grid layout. Dispatches off
 * `parent.getLayoutManager() instanceof Gtk.GridLayout`, so the marker
 * works against any widget carrying a `Gtk.GridLayout` — not only
 * `Gtk.Grid` (which uses GridLayout internally by default).
 */
export class GridChildNode extends AttachOnParentVirtualNode<GridChildProps, WidgetNode, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.backingInstance.getLayoutManager() instanceof Gtk.GridLayout;
    }

    public override commitUpdate(oldProps: GridChildProps | null, newProps: GridChildProps): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.parent || !this.children[0]) return;

        if (
            hasChanged(oldProps, newProps, "column") ||
            hasChanged(oldProps, newProps, "row") ||
            hasChanged(oldProps, newProps, "columnSpan") ||
            hasChanged(oldProps, newProps, "rowSpan")
        ) {
            this.applyGridChildProps(this.parent.backingInstance, this.children[0].backingInstance);
        }
    }

    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        attachChild(child, parent);
        this.applyGridChildProps(parent, child);
    }

    private applyGridChildProps(parent: Gtk.Widget, child: Gtk.Widget): void {
        const layout = parent.getLayoutManager();
        if (!(layout instanceof Gtk.GridLayout)) return;

        const layoutChild = layout.getLayoutChild(child) as Gtk.GridLayoutChild;
        layoutChild.column = this.props.column ?? 0;
        layoutChild.row = this.props.row ?? 0;
        layoutChild.columnSpan = this.props.columnSpan ?? 1;
        layoutChild.rowSpan = this.props.rowSpan ?? 1;
    }
}
