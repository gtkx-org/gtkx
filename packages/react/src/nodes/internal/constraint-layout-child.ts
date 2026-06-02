import type { Node } from "../../node.js";
import { createAfterCommitDebounce } from "../../post-commit-queue.js";
import { ConstraintLayoutNode } from "../constraint-layout.js";
import { VirtualNode } from "../virtual.js";

/**
 * Shared base for the three non-rendering markers that configure a
 * `Gtk.ConstraintLayout` from JSX: `<GtkConstraintLayout.Constraint>`,
 * `<GtkConstraintLayout.Guide>`, and `<GtkConstraintLayout.Vfl>`.
 *
 * Encapsulates:
 *
 * - the validity guards (parent must be a {@link ConstraintLayoutNode};
 *   no children accepted);
 * - the post-commit scheduling used to defer application until sibling
 *   `<GtkConstraintLayout.Widget>` wrappers have populated the layout's id
 *   registry.
 *
 * Subclasses implement {@link applyToLayout} (mount or re-apply) and
 * {@link removeFromLayout} (unmount). Subclasses initiate updates by
 * calling {@link scheduleApply}.
 */
export abstract class ConstraintLayoutChildNode<TProps> extends VirtualNode<TProps, ConstraintLayoutNode, never> {
    public override isValidChild(_child: Node): boolean {
        return false;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof ConstraintLayoutNode;
    }

    public override setParent(parent: ConstraintLayoutNode | null): void {
        if (!parent && this.parent) {
            this.removeFromLayout(this.parent);
        }
        super.setParent(parent);
        if (parent) {
            this.scheduleApply();
        }
    }

    public override commitUpdate(oldProps: TProps | null, newProps: TProps): void {
        super.commitUpdate(oldProps, newProps);
        if (this.parent) {
            this.scheduleApply();
        }
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            this.removeFromLayout(this.parent);
        }
        super.detachDeletedInstance();
    }

    protected readonly scheduleApply = createAfterCommitDebounce(() => {
        if (this.parent) {
            this.applyToLayout(this.parent);
        }
    });

    protected abstract applyToLayout(parent: ConstraintLayoutNode): void;
    protected abstract removeFromLayout(parent: ConstraintLayoutNode): void;
}
