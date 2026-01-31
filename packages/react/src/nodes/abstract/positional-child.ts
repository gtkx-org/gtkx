import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import type { Props } from "../../types.js";
import { WidgetNode } from "../widget.js";
import { VirtualSingleChildNode } from "./virtual-single-child.js";

export abstract class PositionalChildNode<P extends Props = Props> extends VirtualSingleChildNode<P> {
    protected abstract attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void;

    protected abstract detachFromParent(parent: Gtk.Widget, child: Gtk.Widget): void;

    public override onRemovedFromParent(parent: Node): void {
        if (parent instanceof WidgetNode && this.childWidget) {
            this.detachChildFromParentWidget(parent.container);
        }
        super.onRemovedFromParent(parent);
    }

    public override detachDeletedInstance(): void {
        if (this.parentWidget && this.childWidget) {
            this.detachChildFromParentWidget(this.parentWidget);
        }
        this.childWidget = null;
        super.detachDeletedInstance();
    }

    protected onChildChange(oldChild: Gtk.Widget | null): void {
        const parent = this.getParentWidget();

        if (oldChild) {
            this.detachWidgetIfAttached(parent, oldChild);
        }
        if (this.childWidget) {
            this.attachToParent(parent, this.childWidget);
        }
    }

    private detachChildFromParentWidget(parent: Gtk.Widget): void {
        if (this.childWidget) {
            this.detachWidgetIfAttached(parent, this.childWidget);
        }
    }

    private detachWidgetIfAttached(parent: Gtk.Widget, child: Gtk.Widget): void {
        const childParent = child.getParent();
        if (childParent && childParent === parent) {
            this.detachFromParent(parent, child);
        }
    }
}
