import type * as Gtk from "@gtkx/ffi/gtk";
import type { ConstraintLayoutWidgetProps } from "../jsx.js";
import type { Node } from "../node.js";
import { scheduleAfterCommit } from "../post-commit-queue.js";
import { ConstraintLayoutNode } from "./constraint-layout.js";
import { attachChild, unparentWidget } from "./internal/widget.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

/**
 * Reconciler node for `<GtkConstraintLayout.Widget>`.
 *
 * Transparent in the GTK tree: the wrapped widget is reparented onto the
 * grandparent (the host widget that owns the constraint layout). Registers
 * `id → widget` on the sibling {@link ConstraintLayoutNode} so
 * `<Constraint>` and `<Vfl>` markers can resolve the id at apply time.
 *
 * Registration runs after the commit so the sibling layout manager has
 * settled into the tree first.
 */
export class ConstraintLayoutWidgetNode extends VirtualNode<ConstraintLayoutWidgetProps, WidgetNode, WidgetNode> {
    private registeredId: string | null = null;
    private registeredWidget: Gtk.Widget | null = null;
    private registeredLayoutNode: ConstraintLayoutNode | null = null;
    private syncScheduled = false;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode && this.children.length === 0;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);
        if (this.parent) {
            attachChild(child.container, this.parent.container);
            this.syncRegistration();
        }
    }

    public override removeChild(child: WidgetNode): void {
        if (this.parent) {
            unparentWidget(child.container);
        }
        this.unregister();
        super.removeChild(child);
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent) {
            for (const child of this.children) {
                unparentWidget(child.container);
            }
            this.unregister();
        }

        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                attachChild(child.container, parent.container);
            }
            this.syncRegistration();
            if (!this.registeredLayoutNode) {
                this.scheduleSync();
            }
        }
    }

    public override commitUpdate(
        oldProps: ConstraintLayoutWidgetProps | null,
        newProps: ConstraintLayoutWidgetProps,
    ): void {
        super.commitUpdate(oldProps, newProps);
        if (oldProps && oldProps.id !== newProps.id) {
            this.unregister();
            this.syncRegistration();
            if (!this.registeredLayoutNode) {
                this.scheduleSync();
            }
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
        if (this.parent) {
            for (const child of this.children) {
                unparentWidget(child.container);
            }
        }
        this.unregister();
        super.detachDeletedInstance();
    }

    private scheduleSync(): void {
        if (this.syncScheduled) return;
        this.syncScheduled = true;
        scheduleAfterCommit(() => {
            this.syncScheduled = false;
            this.syncRegistration();
        });
    }

    private syncRegistration(): void {
        const widget = this.children[0]?.container ?? null;
        const id = this.props.id;
        if (!this.parent || !widget) {
            this.unregister();
            return;
        }

        if (this.registeredId === id && this.registeredWidget === widget) return;

        if (this.registeredId !== null) {
            this.unregister();
        }

        const layoutNode = this.findSiblingLayoutNode();
        if (!layoutNode) return;

        layoutNode.registerTarget(id, widget);
        this.registeredId = id;
        this.registeredWidget = widget;
        this.registeredLayoutNode = layoutNode;
    }

    private unregister(): void {
        if (this.registeredLayoutNode && this.registeredId !== null) {
            this.registeredLayoutNode.unregisterTarget(this.registeredId);
        }
        this.registeredId = null;
        this.registeredWidget = null;
        this.registeredLayoutNode = null;
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
