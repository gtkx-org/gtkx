import { isObjectEqual } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../../types.js";
import { VirtualSingleChildNode } from "./virtual-single-child.js";

export abstract class PositionalChildNode<P extends Props = Props> extends VirtualSingleChildNode<P> {
    protected abstract attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void;

    protected abstract detachFromParent(parent: Gtk.Widget, child: Gtk.Widget): void;

    public override unmount(): void {
        if (this.parent && this.child) {
            const parent = this.parent;
            const oldChild = this.child;
            this.child = null;

            const parentOfOld = oldChild.getParent();
            if (parentOfOld && isObjectEqual(parentOfOld, parent)) {
                this.detachFromParent(parent, oldChild);
            }
        }

        this.parent = null;
        super.unmount();
    }

    protected onChildChange(oldChild: Gtk.Widget | null): void {
        const parent = this.getParent();

        if (oldChild) {
            const parentOfOld = oldChild.getParent();
            if (parentOfOld && isObjectEqual(parentOfOld, parent)) {
                this.detachFromParent(parent, oldChild);
            }
        }
        if (this.child) {
            this.attachToParent(parent, this.child);
        }
    }
}
