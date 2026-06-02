import type * as Gtk from "@gtkx/gi/gtk";
import type { Node } from "../node.js";
import { LayoutManagerNode } from "./layout-manager.js";

/**
 * Reconciler node specialisation for `Gtk.ConstraintLayout`.
 *
 * Holds the id→target registry that sibling `<GtkConstraintLayout.Widget>`
 * markers and child `<Constraint>`/`<Guide>`/`<Vfl>` markers consult. The
 * registry is private to ConstraintLayout because the other built-in layout
 * managers neither accept Constraint/Guide/Vfl children nor support
 * id-based references.
 *
 */
export class ConstraintLayoutNode extends LayoutManagerNode<Gtk.ConstraintLayout> {
    private readonly targetRegistry = new Map<string, Gtk.ConstraintTarget>();

    public override isValidChild(child: Node): boolean {
        return (
            child.typeName === "Constraint" ||
            child.typeName === "ConstraintGuide" ||
            child.typeName === "ConstraintVfl"
        );
    }

    public override detachDeletedInstance(): void {
        this.targetRegistry.clear();
        super.detachDeletedInstance();
    }

    /**
     * Registers `target` under `id` so descendant `<Constraint>` and `<Vfl>`
     * markers can resolve it by name.
     */
    public registerTarget(id: string, target: Gtk.ConstraintTarget): void {
        this.targetRegistry.set(id, target);
    }

    /**
     * Removes `id` from the target registry; called when a `<Widget>` or
     * `<Guide>` marker leaves the React tree.
     */
    public unregisterTarget(id: string): void {
        this.targetRegistry.delete(id);
    }

    /**
     * Looks up the {@link Gtk.ConstraintTarget} previously registered under
     * `id`. Returns `null` for the `"super"` sentinel (the layout-owning
     * widget) and `undefined` when the id is unknown.
     */
    public resolveTarget(id: string | undefined): Gtk.ConstraintTarget | null | undefined {
        if (id === undefined || id === "super") return null;
        return this.targetRegistry.get(id);
    }

    /**
     * Returns a fresh copy of the id→target map for the VFL marker to build
     * its `views` argument at apply time, without exposing the live registry.
     */
    public snapshotTargets(): Map<string, Gtk.ConstraintTarget> {
        return new Map(this.targetRegistry);
    }
}
