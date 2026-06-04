import type * as Gtk from "@gtkx/gi/gtk";
import type { ConstraintLayoutWidgetProps } from "../jsx.js";
import type { Node } from "../node.js";
import { ConstraintLayoutNode } from "./constraint-layout.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { attachChild } from "./internal/widget.js";
import { WidgetRegistrationController } from "./internal/widget-registration.js";
import { WidgetNode } from "./widget.js";

/**
 * Reconciler node for `<GtkConstraintLayout.Widget>`.
 *
 * Transparent in the GTK tree: the wrapped widget is reparented onto the
 * grandparent (the host widget that owns the constraint layout) by the
 * {@link AttachOnParentVirtualNode} base. Registers `id → widget` on the sibling
 * {@link ConstraintLayoutNode} so `<Constraint>` and `<Vfl>` markers can resolve
 * the id at apply time.
 *
 * Registration runs after the commit so the sibling layout manager has
 * settled into the tree first.
 */
export class ConstraintLayoutWidgetNode extends AttachOnParentVirtualNode<
    ConstraintLayoutWidgetProps,
    WidgetNode,
    WidgetNode
> {
    private readonly registration = new WidgetRegistrationController<{
        layoutNode: ConstraintLayoutNode;
        id: string;
    }>({
        resolveWidget: () => (this.parent ? (this.children[0]?.backingInstance ?? null) : null),
        register: (widget) => {
            const layoutNode = this.findSiblingLayoutNode();
            if (!layoutNode) return null;
            const id = this.props.id;
            layoutNode.registerTarget(id, widget);
            return { layoutNode, id };
        },
        unregister: ({ layoutNode, id }) => layoutNode.unregisterTarget(id),
        identity: () => this.props.id,
    });

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode && this.children.length === 0;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        attachChild(child, parent);
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);
        if (this.parent) {
            this.registration.sync();
        }
    }

    public override removeChild(child: WidgetNode): void {
        this.registration.unregister();
        super.removeChild(child);
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent) {
            this.registration.unregister();
        }

        super.setParent(parent);

        if (parent) {
            this.syncRegistration();
        }
    }

    public override commitUpdate(
        oldProps: ConstraintLayoutWidgetProps | null,
        newProps: ConstraintLayoutWidgetProps,
    ): void {
        super.commitUpdate(oldProps, newProps);
        if (oldProps && oldProps.id !== newProps.id) {
            this.syncRegistration();
        }
    }

    public override finalizeInitialChildren(props: ConstraintLayoutWidgetProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitMount(): void {
        if (this.children.length === 0) return;
        if (!this.findSiblingLayoutNode()) {
            throw new Error(
                "<GtkConstraintLayout.Widget> must be a sibling of <GtkConstraintLayout> under the same widget parent",
            );
        }
    }

    public override detachDeletedInstance(): void {
        this.registration.unregister();
        super.detachDeletedInstance();
    }

    private syncRegistration(): void {
        this.registration.sync();
        if (!this.registration.isRegistered()) {
            this.registration.scheduleSync();
        }
    }

    private findSiblingLayoutNode(): ConstraintLayoutNode | null {
        if (!this.parent) return null;
        for (const sibling of this.parent.children) {
            if (sibling instanceof ConstraintLayoutNode) {
                return sibling;
            }
        }
        return null;
    }
}
