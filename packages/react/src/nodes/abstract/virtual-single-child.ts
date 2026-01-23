import { isObjectEqual } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { CommitPriority, scheduleAfterCommit } from "../../scheduler.js";
import type { Props } from "../../types.js";
import type { Attachable } from "../internal/predicates.js";
import { VirtualNode } from "../virtual.js";
import { WidgetNode } from "../widget.js";

export abstract class VirtualSingleChildNode<P extends Props = Props> extends VirtualNode<P> implements Attachable {
    protected parent: Gtk.Widget | null = null;
    child: Gtk.Widget | null = null;

    public setParent(parent: Gtk.Widget | null): void {
        this.parent = parent;
    }

    protected getParent(): Gtk.Widget {
        if (!this.parent) {
            throw new Error(`Expected parent widget to be set on ${this.typeName}`);
        }
        return this.parent;
    }

    protected getTypedParent<T extends Gtk.Widget>(): T {
        return this.getParent() as T;
    }

    protected abstract onChildChange(oldChild: Gtk.Widget | null): void;

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected Widget`);
        }

        const oldChild = this.child;
        this.child = child.container;

        scheduleAfterCommit(() => {
            if (this.parent) {
                this.onChildChange(oldChild);
            }
        }, CommitPriority.NORMAL);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected Widget`);
        }

        const oldChild = this.child;

        scheduleAfterCommit(() => {
            if (isObjectEqual(oldChild, this.child)) {
                this.child = null;
            }

            if (this.parent && oldChild) {
                this.onChildChange(oldChild);
            }
        }, CommitPriority.HIGH);
    }

    public canBeChildOf(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public attachTo(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.setParent(parent.container);
        }
    }

    public detachFrom(_parent: Node): void {}
}
