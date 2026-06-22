export { gtkxBundledModulePatterns } from "./bundled-modules.js";
export {
    defineConfig,
    GIR_NAMESPACE_PATTERN,
    type GtkxConfig,
    type GtkxConfigEnv,
    type GtkxConfigExport,
    type GtkxConfigFn,
    type GtkxConfigFnPromise,
    LIBRARIES_WILDCARD,
    mergeConfig,
    type ReactCompilerCompilationMode,
    type ReactCompilerOptions,
    type ReactCompilerPanicThreshold,
    type ResolvedGtkxConfig,
    type ResolvedReactCompilerOptions,
    resolveGtkxConfig,
    resolveReactCompilerOptions,
    validateGtkxConfig,
} from "./config.js";
export { DATA_IMPORT_KEY, DATA_IMPORT_PREFIX, resolveDataDir } from "./data-dir.js";
export {
    createGtkxConfigLoader,
    type GtkxConfigLoader,
    GtkxConfigNotFoundError,
    type LoadedConfig,
    type LoadGtkxConfigOptions,
    type LoadResolvedGtkxConfigOptions,
    loadGtkxConfig,
    loadResolvedGtkxConfig,
} from "./loader.js";
export { createGtkxConfigPlugin, type GtkxConfigPluginOptions } from "./plugin.js";
export type {
    AddMethodArg,
    AddMethodRule,
    PageMetaSetter,
    PropCondition,
    PropRule,
    SetterPropGroup,
    SetterPropStep,
    SignalPropRule,
} from "./table-rules-ir.js";
export type {
    ArrayPropRow,
    AttachShape,
    AttachShapeTable,
    AttachVerb,
    CallArg,
    CallStep,
    ConstructSetter,
    ConstructStep,
    ContainerPropRow,
    DetachGuard,
    ElementMapRule,
    MethodVerb,
    ObjectPropRow,
    OrderedInsertVerb,
    PerElementPropRows,
    PresenceCondition,
    UserTableRows,
    VerbArgs,
    VirtualPropRow,
} from "./table-schema.js";
export {
    CAMEL_CASE_NAME_PATTERN,
    PASCAL_CASE_NAME_PATTERN,
    validateArrayOf,
} from "./validators.js";
export {
    GTKX_CONFIG_VIRTUAL_ID,
    RESOLVED_GTKX_CONFIG_VIRTUAL_ID,
    renderGtkxConfigModule,
    type SerializedGtkxConfig,
    serializeGtkxConfig,
} from "./virtual.js";
export {
    BUFFER_TEXT_KIND,
    CONTAINER_PROP_KIND,
    LABEL_TEXT_KIND,
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    OVERLAY_KIND,
    SLOT_KIND,
    TAB_LABEL_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
    WRAPPER_NODE_ELEMENT,
} from "./wrapper-protocol.js";
