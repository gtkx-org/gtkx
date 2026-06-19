/**
 * The reconciler wrapper protocol shared between codegen and the runtime.
 *
 * Codegen emits one sentinel JSX element per metadata wrapper child, tagged
 * with a `kind` discriminator; the `@gtkx/react` reconciler matches both to
 * attach the child to the right parent. Defining the sentinel name and every
 * kind here keeps the emitter (`@gtkx/jsx`) and the matcher (`@gtkx/react`)
 * from drifting, since a mismatch fails silently at attach time.
 */

/** The single JSX element name every metadata wrapper renders. */
export const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/** Wrapper kind for a metadata child attached to its grandparent (e.g. a stack or notebook page). */
export const META_OBJECT_KIND = "meta-object";

/** Wrapper kind for a layout-manager child (e.g. a grid or fixed cell). */
export const LAYOUT_CHILD_KIND = "layout-child";

/** Wrapper kind for an overlay child. */
export const OVERLAY_KIND = "overlay";

/** Wrapper kind for a notebook page's tab label. */
export const TAB_LABEL_KIND = "tab-label";

/** Wrapper kind for an element-valued prop lifted into a slot child. */
export const SLOT_KIND = "slot";

/** Wrapper kind for a prop appended to its parent through a named container method. */
export const CONTAINER_PROP_KIND = "container-slot";

/** Wrapper kind for a widget anchored into a text buffer. */
export const TEXT_ANCHOR_KIND = "text-anchor";

/** Wrapper kind for an inline paintable embedded in a text buffer. */
export const TEXT_PAINTABLE_KIND = "text-paintable";

/** Wrapper kind for a raw text run inside a text buffer. */
export const BUFFER_TEXT_KIND = "text";

/** Wrapper kind for a raw text run inside a label. */
export const LABEL_TEXT_KIND = "label-text";
