import * as Gtk from "@gtkx/ffi/gtk";
import type { GridChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { hasChanged } from "./internal/props.js";
import { attachChild, unparentWidget } from "./internal/widget.js";
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
        return parent instanceof WidgetNode && parent.container.getLayoutManager() instanceof Gtk.GridLayout;
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
            this.applyGridChildProps(this.parent.container, this.children[0].container);
        }
    }

    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        attachChild(child, parent);
        this.applyGridChildProps(parent, child);
    }

    protected override detachFromParent(_parent: Gtk.Widget, child: Gtk.Widget): void {
        unparentWidget(child);
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
