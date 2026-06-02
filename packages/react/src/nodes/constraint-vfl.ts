import type * as Gtk from "@gtkx/gi/gtk";
import type { ConstraintVflProps } from "../jsx.js";
import type { ConstraintLayoutNode } from "./constraint-layout.js";
import { ConstraintLayoutChildNode } from "./internal/constraint-layout-child.js";

/**
 * Reconciler node for `<GtkConstraintLayout.Vfl>`.
 *
 * Wraps `Gtk.ConstraintLayout.addConstraintsFromDescription`. Reads the
 * sibling target registry (populated by `<Widget id="…">` wrappers and
 * `<Guide id="…">` markers) at apply time, then stores the returned
 * `Constraint[]` so the markup can be diffed on update.
 */
export class ConstraintVflNode extends ConstraintLayoutChildNode<ConstraintVflProps> {
    private appliedConstraints: Gtk.Constraint[] = [];

    protected override applyToLayout(parent: ConstraintLayoutNode): void {
        this.removeFromLayout(parent);

        const views = parent.snapshotTargets();

        try {
            this.appliedConstraints = parent.backingInstance.addConstraintsFromDescription(
                this.props.lines,
                this.props.hspacing ?? 0,
                this.props.vspacing ?? 0,
                views,
            );
        } catch (e) {
            console.error("VFL parsing error:", e);
            this.appliedConstraints = [];
        }
    }

    protected override removeFromLayout(parent: ConstraintLayoutNode): void {
        for (const constraint of this.appliedConstraints) {
            parent.backingInstance.removeConstraint(constraint);
        }
        this.appliedConstraints = [];
    }
}
