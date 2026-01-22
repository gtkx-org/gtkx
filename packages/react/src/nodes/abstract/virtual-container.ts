import { isObjectEqual } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { CommitPriority, scheduleAfterCommit } from "../../scheduler.js";
import { VirtualNode } from "../virtual.js";
import { WidgetNode } from "../widget.js";

type ChildParentWidget = Gtk.Widget & {
    remove(child: Gtk.Widget): void;
};

export abstract class VirtualContainerNode<P extends ChildParentWidget = ChildParentWidget> extends VirtualNode {
    protected parent: P | null = null;

    public setParent(newParent: P | null): void {
        this.parent = newParent;
    }

    protected getParent(): P {
        if (!this.parent) {
            throw new Error(`Expected parent widget to be set on ${this.typeName}`);
        }
        return this.parent;
    }

    protected abstract attachChild(parent: P, widget: Gtk.Widget): void;

    public override unmount(): void {
        this.parent = null;
        super.unmount();
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected Widget`);
        }

        const widget = child.container;

        scheduleAfterCommit(() => {
            const parent = this.parent;
            if (parent) {
                this.attachChild(parent, widget);
            }
        }, CommitPriority.NORMAL);
    }

    public override insertBefore(child: Node, _before: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}': expected Widget`);
        }

        const widget = child.container;

        scheduleAfterCommit(() => {
            const parent = this.parent;
            if (parent) {
                this.attachChild(parent, widget);
            }
        }, CommitPriority.NORMAL);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        const parent = this.parent;

        scheduleAfterCommit(() => {
            if (parent) {
                const currentParent = widget.getParent();

                if (currentParent && isObjectEqual(currentParent, parent)) {
                    parent.remove(widget);
                }
            }
        }, CommitPriority.HIGH);
    }
}
