/**
 * Wrapper-protocol tags shared verbatim between `@gtkx/config`, `@gtkx/react`,
 * and `@gtkx/codegen`.
 *
 * The reconciler models non-widget JSX nodes (slots, metadata objects, text
 * fragments, and similar) as synthetic "wrapper" host nodes rather than live
 * GObjects. Each wrapper carries a `kind` tag drawn from these constants so the
 * element-map attachment logic can recognize it; codegen emits the same tags
 * into compound components, and the reconciler matches against them at attach
 * time. Both sides import these constants so the tag strings can never drift
 * apart.
 */

/**
 * The intrinsic element type for a synthetic wrapper host node, distinguishing
 * it from a real GTK widget element in the reconciler.
 */
export const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/**
 * Wrapper kind for a metadata GObject attached to its parent (e.g. a notebook
 * page or stack page meta object) rather than added as a widget child.
 */
export const META_OBJECT_KIND = "meta-object";

/**
 * Wrapper kind for a child whose props configure the parent's layout manager
 * (a layout child) instead of contributing a widget of its own.
 */
export const LAYOUT_CHILD_KIND = "layout-child";

/**
 * Wrapper kind for a child added as an overlay onto a `Gtk.Overlay` parent.
 */
export const OVERLAY_KIND = "overlay";

/**
 * Wrapper kind for the tab-label child of a notebook page.
 */
export const TAB_LABEL_KIND = "tab-label";

/**
 * Wrapper kind for a child filling a named widget slot via a setter method.
 */
export const SLOT_KIND = "slot";

/**
 * Wrapper kind for a child filling a container-prop slot, attached through the
 * parent's container method.
 */
export const CONTAINER_PROP_KIND = "container-slot";

/**
 * Wrapper kind for a text-anchor fragment embedded in a text buffer.
 */
export const TEXT_ANCHOR_KIND = "text-anchor";

/**
 * Wrapper kind for a paintable fragment embedded in a text buffer.
 */
export const TEXT_PAINTABLE_KIND = "text-paintable";

/**
 * Wrapper kind for a plain text fragment destined for a text buffer.
 */
export const BUFFER_TEXT_KIND = "text";

/**
 * Wrapper kind for a plain text fragment destined for a label's text property.
 */
export const LABEL_TEXT_KIND = "label-text";
