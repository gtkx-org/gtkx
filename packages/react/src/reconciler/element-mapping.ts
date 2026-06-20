import type * as GObject from "@gtkx/gi/gobject";
import type { Node } from "./state.js";

/**
 * One attach/detach rule of the reconciler's element map. The reconciler
 * applies the first entry whose {@link ElementMapping.matches} holds for a
 * `(child, parent)` pair.
 */
export interface ElementMapping {
    /** Whether this mapping governs attaching `child` to `parent`. */
    matches(child: Node, parent: Node): boolean;
    /**
     * Attaches `child` to `parent`. Idempotent: re-invoked when a wrapper child's
     * own content or metadata changes, so it reconciles against any prior attach
     * recorded in the mapping's own per-node `WeakMap`. `anchor` is the next
     * sibling's backing instance for ordered insertion, or `null`/`undefined` to
     * append. `fresh` marks a child the reconciler has not attached before, so its
     * backing widget is known to be unparented and the defensive unparent can be skipped.
     */
    attach(child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void;
    /** Reverses {@link attach}, removing `child` from `parent`. */
    detach(child: Node, parent: Node): void;
}
