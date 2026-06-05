import type * as Gtk from "@gtkx/gi/gtk";
import type { Node } from "../../node.js";
import { VirtualNode } from "../virtual.js";
import { WidgetNode } from "../widget.js";

/**
 * Base class for virtual nodes that wrap a single child widget and need to
 * react when that child changes. Concrete subclasses implement `onChildChange`
 * (called whenever the wrapped child is added, replaced, or removed while the
 * parent is attached) and `onDetach` (called when the node is being removed
 * from its parent — either via `setParent(null)` or `detachDeletedInstance`).
 *
 * The wrapped child defaults to the first child. Subclasses whose child set
 * mixes the wrapped widget with non-widget markers (e.g. a notebook page's
 * content widget alongside its tab marker) override {@link trackedChild} to
 * select the widget the hooks operate on; non-widget children are left to the
 * subclass and never trigger `onChildChange`/`onDetach`.
 */
export abstract class SingleChildVirtualNode<
    TProps,
    TParent extends Node,
    TChild extends Node = WidgetNode,
> extends VirtualNode<TProps, TParent, TChild> {
    public override appendChild(child: TChild): void {
        this.withTrackedChildChange(() => super.appendChild(child));
    }

    public override removeChild(child: TChild): void {
        this.withTrackedChildChange(() => super.removeChild(child));
    }

    public override insertBefore(child: TChild, before: TChild): void {
        this.withTrackedChildChange(() => super.insertBefore(child, before));
    }

    /**
     * Runs a child-list mutation and fires {@link onChildChange} when it leaves
     * the tracked child's backing widget different from before, while the node is
     * attached. Comparing the tracked widget across the mutation keeps the hook
     * firing for every way React can introduce, replace, or remove the wrapped
     * child — append, remove, and insert-before alike — while skipping mutations
     * that only reorder non-tracked siblings.
     */
    private withTrackedChildChange(mutate: () => void): void {
        const oldChildWidget = this.trackedChild()?.backingInstance ?? null;
        mutate();
        const newChildWidget = this.trackedChild()?.backingInstance ?? null;
        if (this.parent && newChildWidget !== oldChildWidget) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override setParent(parent: TParent | null): void {
        if (!parent && this.parent) {
            this.onDetach(this.trackedChild()?.backingInstance ?? null);
        }
        super.setParent(parent);
        if (parent && this.trackedChild()) {
            this.onChildChange(null);
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent && this.detachesOnDelete()) {
            this.onDetach(this.trackedChild()?.backingInstance ?? null);
        }
        super.detachDeletedInstance();
    }

    /**
     * The widget child the lifecycle hooks operate on. Defaults to the first
     * child when it is a widget; subclasses with mixed child kinds override it
     * to pick the wrapped widget out of their children.
     */
    protected trackedChild(): WidgetNode | null {
        const first = this.children[0];
        return first instanceof WidgetNode ? first : null;
    }

    /**
     * Whether {@link onDetach} runs when this node is deleted as part of its
     * parent's subtree, rather than detached from a surviving parent via
     * `setParent(null)`. Defaults to `true`. Subclasses whose `onDetach`
     * mutates the parent widget override this to `false` so they do not touch a
     * parent that is itself being destroyed in the same teardown.
     */
    protected detachesOnDelete(): boolean {
        return true;
    }

    protected abstract onChildChange(oldChild: Gtk.Widget | null): void;
    protected abstract onDetach(oldChild: Gtk.Widget | null): void;
}
