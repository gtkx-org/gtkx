import type * as Gtk from "@gtkx/ffi/gtk";
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
            this.detachFromParent(this.parent.container, child.container);
            this.attachToParent(this.parent.container, child.container);
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
            this.detachFromParent(this.parent.container, child.container);
        }
        super.removeChild(child);
    }

    public override setParent(parent: TParent | null): void {
        if (!parent && this.parent) {
            const currentParent = this.parent.container;
            for (const child of this.children) {
                this.detachFromParent(currentParent, child.container);
            }
        }
        super.setParent(parent);
        if (parent) {
            for (const child of this.children) {
                this.attachToParent(parent.container, child.container);
            }
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            const currentParent = this.parent.container;
            for (const child of this.children) {
                this.detachFromParent(currentParent, child.container);
            }
        }
        super.detachDeletedInstance();
    }

    protected reinsertAllChildren(): void {
        if (!this.parent) return;
        const parent = this.parent.container;
        for (const child of this.children) {
            this.detachFromParent(parent, child.container);
        }
        for (const child of this.children) {
            this.attachToParent(parent, child.container);
        }
    }

    protected abstract attachToParent(parent: TParent["container"], child: Gtk.Widget): void;

    protected detachFromParent(_parent: TParent["container"], child: Gtk.Widget): void {
        unparentWidget(child);
    }
}
