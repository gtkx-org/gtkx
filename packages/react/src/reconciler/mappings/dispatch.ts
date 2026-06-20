/**
 * The reconciler's attach/detach dispatch.
 *
 * Resolves a `(child, parent)` pair to the first matching {@link ElementMapping}
 * and runs its `attach`/`detach`. The mapping table is injected by the element
 * map at module load through {@link setElementMap}, so a strategy can re-dispatch
 * through {@link attachToParent} without a static import back to the table that
 * lists it.
 */
import type * as GObject from "@gtkx/gi/gobject";
import type { ElementMapping } from "../element-mapping.js";
import { isWrapperElement } from "../wrapper-element.js";
import { type Node, stateOf } from "../state.js";

let elementMap: readonly ElementMapping[] = [];

/**
 * Installs the ordered mapping table the dispatch resolves against. Called once
 * by the element map at module load.
 *
 * @param mappings - The element-map strategies, in match-priority order.
 */
export const setElementMap = (mappings: readonly ElementMapping[]): void => {
    elementMap = mappings;
};

const resolveMapping = (child: Node, parent: Node): ElementMapping | undefined =>
    elementMap.find((mapping) => mapping.matches(child, parent));

/**
 * Attaches `child` to `parent` through the first matching mapping. `anchor` is
 * the next sibling's backing instance for ordered insertion.
 *
 * @param child - The child node being attached.
 * @param parent - The parent node it attaches to.
 * @param anchor - The next sibling's backing instance, or `null` to append.
 * @param fresh - Whether the child has not been attached before, so its backing
 *   widget is known unparented and the defensive unparent can be skipped.
 */
export const attachToParent = (child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void => {
    resolveMapping(child, parent)?.attach(child, parent, anchor, fresh);
};

/**
 * Reverses {@link attachToParent}, detaching `child` from `parent`.
 *
 * @param child - The child node being detached.
 * @param parent - The parent node it detaches from.
 */
export const detachFromParent = (child: Node, parent: Node): void => {
    resolveMapping(child, parent)?.detach(child, parent);
};

/**
 * Re-runs a metadata wrapper's idempotent attach against its current parent so
 * its content and metadata reconcile after a child or prop change.
 *
 * @param marker - The wrapper node to resynchronize.
 */
export const resyncWrapper = (marker: Node): void => {
    const parent = stateOf(marker).parent;
    if (isWrapperElement(marker) && parent) attachToParent(marker, parent);
};
