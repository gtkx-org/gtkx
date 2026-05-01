import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../../node.js";
import { VirtualNode } from "../virtual.js";
import type { WidgetNode } from "../widget.js";

/**
 * Base class for virtual nodes that wrap a single child widget and need to
 * react when that child changes. Concrete subclasses implement `onChildChange`
 * (called whenever the wrapped child is added, replaced, or removed while the
 * parent is attached) and `onDetach` (called when the node is being removed
 * from its parent — either via `setParent(null)` or `detachDeletedInstance`).
 */
export abstract class SingleChildVirtualNode<
    TProps,
    TParent extends Node,
    TChild extends WidgetNode,
    // biome-ignore lint/suspicious/noExplicitAny: matches VirtualNode's loose bound
> extends VirtualNode<TProps, TParent, TChild & any> {
    public override appendChild(child: TChild): void {
        const oldChildWidget = this.children[0]?.container ?? null;
        super.appendChild(child);
        if (this.parent) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override removeChild(child: TChild): void {
        const oldChildWidget = child.container;
        super.removeChild(child);
        if (this.parent && oldChildWidget) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override setParent(parent: TParent | null): void {
        if (!parent && this.parent) {
            this.onDetach(this.children[0]?.container ?? null);
        }
        super.setParent(parent);
        if (parent && this.children[0]) {
            this.onChildChange(null);
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            this.onDetach(this.children[0]?.container ?? null);
        }
        super.detachDeletedInstance();
    }

    protected abstract onChildChange(oldChild: Gtk.Widget | null): void;
    protected abstract onDetach(oldChild: Gtk.Widget | null): void;
}
