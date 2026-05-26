import * as Gtk from "@gtkx/ffi/gtk";
import type { ConstraintProps } from "../jsx.js";
import type { ConstraintLayoutNode } from "./constraint-layout.js";
import { ConstraintLayoutChildNode } from "./internal/constraint-layout-child.js";

/**
 * Reconciler node for `<GtkConstraintLayout.Constraint>`.
 *
 * `Gtk.Constraint` objects are immutable after construction, so any prop
 * change forces a remove-old / add-new cycle on the owning `Gtk.ConstraintLayout`.
 */
export class ConstraintNode extends ConstraintLayoutChildNode<ConstraintProps> {
    private constraint: Gtk.Constraint | null = null;

    protected override applyToLayout(parent: ConstraintLayoutNode): void {
        const layout = parent.container;

        if (this.constraint) {
            layout.removeConstraint(this.constraint);
            this.constraint = null;
        }

        const target = parent.resolveTarget(this.props.target);
        const source = parent.resolveTarget(this.props.source);

        if (target === undefined) {
            throw new Error(this.unknownIdMessage("target", this.props.target));
        }
        if (source === undefined) {
            throw new Error(this.unknownIdMessage("source", this.props.source));
        }

        this.constraint = Gtk.Constraint.new(
            target,
            this.props.targetAttribute,
            this.props.relation ?? Gtk.ConstraintRelation.EQ,
            source,
            this.props.sourceAttribute ?? Gtk.ConstraintAttribute.NONE,
            this.props.multiplier ?? 1,
            this.props.constant ?? 0,
            this.props.strength ?? Gtk.ConstraintStrength.REQUIRED,
        );
        layout.addConstraint(this.constraint);
    }

    protected override removeFromLayout(parent: ConstraintLayoutNode): void {
        if (this.constraint) {
            parent.container.removeConstraint(this.constraint);
        }
        this.constraint = null;
    }

    private unknownIdMessage(role: "target" | "source", id: string | undefined): string {
        return (
            `<GtkConstraintLayout.Constraint> references unknown id '${id}'. ` +
            `Wrap the ${role} widget in <GtkConstraintLayout.Widget id="${id}"> or ` +
            `add a <GtkConstraintLayout.Guide id="${id}">.`
        );
    }
}
