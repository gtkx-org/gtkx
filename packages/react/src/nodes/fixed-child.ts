import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import type { FixedChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

export class FixedChildNode extends AttachOnParentVirtualNode<FixedChildProps, WidgetNode<Gtk.Fixed>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.Fixed;
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

    protected override attachToParent(parent: Gtk.Fixed, child: Gtk.Widget): void {
        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;
        parent.put(child, x, y);
        this.applyLayoutTransform();
    }

    private applyLayoutTransform(): void {
        if (!this.parent || !this.children[0]) return;

        const layoutManager = this.parent.container.getLayoutManager();
        if (!layoutManager) return;

        const layoutChild = layoutManager.getLayoutChild(this.children[0].container) as Gtk.FixedLayoutChild;

        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;
        const position = new Graphene.Point();
        position.init(x, y);

        let transform: Gsk.Transform | null = new Gsk.Transform();
        transform = transform.translate(position);

        if (this.props.transform && transform) {
            transform = transform.transform(this.props.transform);
        }

        if (transform) {
            layoutChild.setTransform(transform);
        }
    }
}
