import type * as Gtk from "@gtkx/ffi/gtk";
import type { FixedChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/utils.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type Props = FixedChildProps;

export class FixedChildNode extends VirtualNode<Props, WidgetNode<Gtk.Fixed>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode<Gtk.Fixed> | null): void {
        const previousParent = this.parent;
        super.setParent(parent);

        if (parent && this.children[0]) {
            this.attachToParent(parent.container, this.children[0].container);
            this.applyTransform();
        } else if (previousParent && this.children[0]) {
            this.detachWidgetIfAttached(previousParent.container, this.children[0].container);
        }
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);

        if (this.parent) {
            this.attachToParent(this.parent.container, child.container);
            this.applyTransform();
        }
    }

    public override removeChild(child: WidgetNode): void {
        const widget = child.container;

        super.removeChild(child);

        if (this.parent) {
            this.detachWidgetIfAttached(this.parent.container, widget);
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent && this.children[0]) {
            this.detachWidgetIfAttached(this.parent.container, this.children[0].container);
        }
        super.detachDeletedInstance();
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.parent || !this.children[0]) {
            return;
        }

        const positionChanged = hasChanged(oldProps, newProps, "x") || hasChanged(oldProps, newProps, "y");

        if (positionChanged) {
            this.repositionChild();
        } else if (hasChanged(oldProps, newProps, "transform")) {
            this.applyTransform();
        }
    }

    private attachToParent(parent: Gtk.Fixed, child: Gtk.Widget): void {
        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;
        parent.put(child, x, y);
    }

    private detachWidgetIfAttached(parent: Gtk.Fixed, child: Gtk.Widget): void {
        const childParent = child.getParent();
        if (childParent && childParent === parent) {
            parent.remove(child);
        }
    }

    private repositionChild(): void {
        if (!this.parent || !this.children[0]) return;

        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;

        this.parent.container.remove(this.children[0].container);
        this.parent.container.put(this.children[0].container, x, y);
        this.applyTransform();
    }

    private applyTransform(): void {
        if (!this.parent || !this.children[0] || !this.props.transform) {
            return;
        }

        const layoutManager = this.parent.container.getLayoutManager();

        if (!layoutManager) {
            return;
        }

        const layoutChild = layoutManager.getLayoutChild(this.children[0].container) as Gtk.FixedLayoutChild;
        layoutChild.setTransform(this.props.transform);
    }
}
