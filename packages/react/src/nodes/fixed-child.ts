import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import type { FixedChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { hasChanged } from "./internal/props.js";
import { attachChild, unparentWidget } from "./internal/widget.js";
import { WidgetNode } from "./widget.js";

/**
 * Reconciler node for `<GtkFixed.Child>`.
 *
 * Positions a widget at an `(x, y)` offset with an optional 3D transform.
 * Dispatches off `parent.getLayoutManager() instanceof Gtk.FixedLayout`,
 * so the marker works against any widget carrying a `Gtk.FixedLayout` —
 * not only `Gtk.Fixed` (which uses FixedLayout internally by default).
 */
export class FixedChildNode extends AttachOnParentVirtualNode<FixedChildProps, WidgetNode, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container.getLayoutManager() instanceof Gtk.FixedLayout;
    }

    public override commitUpdate(oldProps: FixedChildProps | null, newProps: FixedChildProps): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.parent || !this.children[0]) {
            return;
        }

        if (
            hasChanged(oldProps, newProps, "x") ||
            hasChanged(oldProps, newProps, "y") ||
            hasChanged(oldProps, newProps, "transform")
        ) {
            this.applyLayoutTransform();
        }
    }

    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        attachChild(child, parent);
        this.applyLayoutTransform();
    }

    protected override detachFromParent(_parent: Gtk.Widget, child: Gtk.Widget): void {
        unparentWidget(child);
    }

    private applyLayoutTransform(): void {
        if (!this.parent || !this.children[0]) return;

        const layoutManager = this.parent.container.getLayoutManager();
        if (!(layoutManager instanceof Gtk.FixedLayout)) return;

        const layoutChild = layoutManager.getLayoutChild(this.children[0].container) as Gtk.FixedLayoutChild;

        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;
        const position = new Graphene.Point();
        position.init(x, y);

        let transform: Gsk.Transform | null = Gsk.Transform.new();
        transform = transform.translate(position);

        if (this.props.transform && transform) {
            transform = transform.transform(this.props.transform);
        }

        if (transform) {
            layoutChild.setTransform(transform);
        }
    }
}
