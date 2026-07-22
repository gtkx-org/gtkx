export { createApplicationComponent } from "./components/application.js";
export { createWindowComponent } from "./components/window.js";
export { ApplicationContext } from "./hooks/use-application.js";
export { useMergedRef } from "./hooks/use-merged-refs.js";
export { useObjectValue } from "./hooks/use-object-value.js";
export { createElementComponent, createLazyElementComponent } from "./reconciler/create-element-component.js";
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
    WRAPPER_NODE_ELEMENT,
    type WrapperKind,
} from "./reconciler/wrapper-kinds.js";
export { getAccessibleMetadata } from "./utils/accessible-metadata.js";
export { type RefProp, resolveRefProp } from "./utils/ref-prop.js";
