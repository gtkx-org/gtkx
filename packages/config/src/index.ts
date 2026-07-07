export {
    DEFAULT_APPLICATION_ID,
    defineConfig,
    GIR_LIBRARY_PATTERN,
    type GtkxConfig,
    isValidApplicationId,
    LIBRARIES_WILDCARD,
    mergeConfig,
    type ResolvedGtkxConfig,
    type ResolvedReactCompilerOptions,
    resolveReactCompilerOptions,
} from "./config.js";
export type {
    AppliedProp,
    Arg,
    ArgRef,
    Call,
    ContainerProp,
    ControlledTextProp,
    ElementProp,
    LazyProp,
    ListProp,
    ValueProp,
} from "./element-props.js";
export { createGtkxConfigLoader, type GtkxConfigLoader, loadGtkxConfig } from "./loader.js";
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
} from "./wrapper-protocol.js";
