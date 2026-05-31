import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { createContainerWithProperties } from "./internal/construct.js";
import { WidgetAttachmentNode } from "./internal/widget-attachment-node.js";
import { WidgetNode } from "./widget.js";

/**
 * Reconciler node for `Gtk.LayoutManager` subclasses (`GtkBoxLayout`,
 * `GtkGridLayout`, `GtkConstraintLayout`, …).
 *
 * Constructs the layout manager from JSX props, attaches it to the parent
 * widget via `Gtk.Widget.setLayoutManager`, and clears the slot when the
 * marker leaves the React tree.
 *
 * `GtkConstraintLayout`-specific behaviour (constraint/guide/Vfl children,
 * the id→target registry) lives in {@link ConstraintLayoutNode}.
 *
 * @public
 */
export class LayoutManagerNode<
    T extends Gtk.LayoutManager = Gtk.LayoutManager,
    // biome-ignore lint/suspicious/noExplicitAny: Self-referential type bounds require any
    TChild extends Node = any,
> extends WidgetAttachmentNode<T, TChild> {
    public static override createContainer(
        typeName: string,
        props: Props,
        _containerClass: typeof Gtk.LayoutManager,
    ): Gtk.LayoutManager {
        return createContainerWithProperties(typeName, props) as Gtk.LayoutManager;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent?.container.getLayoutManager() === this.container) {
            this.parent.container.setLayoutManager(null);
        }

        super.setParent(parent);

        if (parent) {
            parent.container.setLayoutManager(this.container);
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent?.container.getLayoutManager() === this.container) {
            this.parent.container.setLayoutManager(null);
        }
        super.detachDeletedInstance();
    }
}
