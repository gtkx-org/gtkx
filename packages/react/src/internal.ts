export { createApplicationComponent } from "./components/application.js";
export { createWindowComponent } from "./components/window.js";
export { useGObjectValue } from "./hooks/use-gobject-value.js";
export { useMergeRefs } from "./hooks/use-merge-refs.js";
export { useTargetRegistration } from "./hooks/use-target-registration.js";
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
export { createElementComponent, createLazyElementComponent } from "./utils/create-element-component.js";
export { type GObjectTarget, resolveGObjectTarget } from "./utils/gobject-target.js";
