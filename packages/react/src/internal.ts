export { useGObjectValue } from "./hooks/use-gobject-value.js";
export { useTargetRegistration } from "./hooks/use-target-registration.js";
export { setReconcilerErrorHandler } from "./reconciler/reconciler-error-handler.js";
export { createReconcilerRoot, type ReconcilerRoot } from "./reconciler/reconciler-root.js";
export { isRootElement } from "./reconciler/root-element.js";
export {
    BUFFER_TEXT_KIND,
    CONTAINER_SLOT_KIND,
    isWrapperKind,
    LABEL_TEXT_KIND,
    LAZY_ELEMENT_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
    WIDGET_PROP_KIND,
    WRAPPER_NODE_ELEMENT,
    type WrapperKind,
} from "./reconciler/wrapper-protocol.js";
export { type GObjectTarget, resolveGObjectTarget } from "./utils/gobject-target.js";
