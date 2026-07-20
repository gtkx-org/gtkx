export { createApplicationComponent } from "./components/application.js";
export { createWindowComponent } from "./components/window.js";
export { ApplicationContext } from "./hooks/use-application.js";
export { useMergedRef } from "./hooks/use-merged-refs.js";
export { useObjectAttachment } from "./hooks/use-object-attachment.js";
export { useObjectValue } from "./hooks/use-object-value.js";
export { setReconcilerErrorHandler } from "./reconciler/reconciler-error-handler.js";
export { createReconcilerRoot, type ReconcilerRoot } from "./reconciler/reconciler-root.js";
export { isRootElement } from "./reconciler/root-element.js";
export {
    BUFFER_TEXT_KIND,
    CONTAINER_PROP_KIND,
    isWrapperKind,
    LABEL_TEXT_KIND,
    LAZY_ELEMENT_KIND,
    OBJECT_PROP_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
    WRAPPER_NODE_ELEMENT,
    type WrapperKind,
} from "./reconciler/wrapper-protocol.js";
export { getAccessibleMetadata } from "./utils/accessible-metadata.js";
export { createElementComponent, createLazyElementComponent } from "./utils/create-element-component.js";
export { type ObjectProp, resolveObjectProp } from "./utils/object-prop.js";
