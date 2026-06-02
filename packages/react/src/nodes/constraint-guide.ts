import * as Gtk from "@gtkx/gi/gtk";
import type { ConstraintGuideProps } from "../jsx.js";
import type { ConstraintLayoutNode } from "./constraint-layout.js";
import { ConstraintLayoutChildNode } from "./internal/constraint-layout-child.js";

/**
 * Reconciler node for `<GtkConstraintLayout.Guide>`.
 *
 * Constructs a `Gtk.ConstraintGuide`, registers its `id` with the owning
 * {@link ConstraintLayoutNode} so sibling `<Constraint>`/`<Vfl>` markers can
 * resolve it by name, and applies size/strength props through the standard
 * setter API (size dimensions are paired in the GTK API).
 */
export class ConstraintGuideNode extends ConstraintLayoutChildNode<ConstraintGuideProps> {
    private guide: Gtk.ConstraintGuide | null = null;
    private registeredId: string | null = null;

    protected override applyToLayout(parent: ConstraintLayoutNode): void {
        if (!this.guide) {
            this.guide = new Gtk.ConstraintGuide();
            parent.backingInstance.addGuide(this.guide);
        }

        this.applyId(parent, this.guide);
        this.applySizes(this.guide);
    }

    protected override removeFromLayout(parent: ConstraintLayoutNode): void {
        if (this.guide) {
            parent.backingInstance.removeGuide(this.guide);
        }
        if (this.registeredId !== null) {
            parent.unregisterTarget(this.registeredId);
            this.registeredId = null;
        }
        this.guide = null;
    }

    private applyId(parent: ConstraintLayoutNode, guide: Gtk.ConstraintGuide): void {
        if (this.registeredId === this.props.id) return;
        if (this.registeredId !== null) {
            parent.unregisterTarget(this.registeredId);
        }
        guide.setName(this.props.id);
        parent.registerTarget(this.props.id, guide);
        this.registeredId = this.props.id;
    }

    private applySizes(guide: Gtk.ConstraintGuide): void {
        guide.setMinSize(this.props.minWidth ?? 0, this.props.minHeight ?? 0);
        guide.setNatSize(this.props.natWidth ?? 0, this.props.natHeight ?? 0);
        guide.setMaxSize(this.props.maxWidth ?? 0, this.props.maxHeight ?? 0);
        if (this.props.strength !== undefined) {
            guide.setStrength(this.props.strength);
        }
    }
}
