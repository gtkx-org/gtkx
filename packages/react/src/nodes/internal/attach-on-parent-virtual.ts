import type * as Gtk from "@gtkx/gi/gtk";
import { VirtualNode } from "../virtual.js";
import type { WidgetNode } from "../widget.js";
import { unparentWidget } from "./widget.js";

/**
 * Base class for virtual nodes whose children must be re-parented to the
 * grandparent GTK widget when the node is attached. Subclasses implement
 * `attachToParent` (how a child is added) and may override `detachFromParent`
 * (how it is removed; defaults to `unparentWidget`).
 *
 * The base handles `setParent`, `appendChild`, `insertBefore`, `removeChild`,
 * and `detachDeletedInstance` so each subclass stays focused on its specific
 * GTK API (e.g. `Gtk.Fixed.put`, `Gtk.Overlay.addOverlay`).
 */
export abstract class AttachOnParentVirtualNode<
    TProps,
    TParent extends WidgetNode,
    TChild extends WidgetNode,
> extends VirtualNode<TProps, TParent, TChild> {
    public override appendChild(child: TChild): void {
        super.appendChild(child);
        if (this.parent) {
            this.detachFromParent(this.parent.backingInstance, child.backingInstance);
            this.attachToParent(this.parent.backingInstance, child.backingInstance);
        }
    }

    public override insertBefore(child: TChild, before: TChild): void {
        super.insertBefore(child, before);
        if (this.parent) {
            this.reinsertAllChildren();
        }
    }

    public override removeChild(child: TChild): void {
        if (this.parent) {
            this.detachFromParent(this.parent.backingInstance, child.backingInstance);
        }
        super.removeChild(child);
    }

    public override setParent(parent: TParent | null): void {
        if (!parent && this.parent) {
            const currentParent = this.parent.backingInstance;
            for (const child of this.children) {
                this.detachFromParent(currentParent, child.backingInstance);
            }
        }
        super.setParent(parent);
        if (parent) {
            for (const child of this.children) {
                this.attachToParent(parent.backingInstance, child.backingInstance);
            }
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            const currentParent = this.parent.backingInstance;
            for (const child of this.children) {
                this.detachFromParent(currentParent, child.backingInstance);
            }
        }
        super.detachDeletedInstance();
    }

    protected reinsertAllChildren(): void {
        if (!this.parent) return;
        const parent = this.parent.backingInstance;
        for (const child of this.children) {
            this.detachFromParent(parent, child.backingInstance);
        }
        for (const child of this.children) {
            this.attachToParent(parent, child.backingInstance);
        }
    }

    protected abstract attachToParent(parent: TParent["backingInstance"], child: Gtk.Widget): void;

    protected detachFromParent(_parent: TParent["backingInstance"], child: Gtk.Widget): void {
        unparentWidget(child);
    }
}
