export { gtkxBundledModulePatterns } from "./bundled-modules.js";
export {
    defineConfig,
    GIR_LIBRARY_PATTERN,
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
export { DATA_IMPORT_PREFIX, resolveDataDir } from "./data-dir.js";
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
    AttachShape,
    AttachShapeTable,
    OrderedInsertSpec,
    PageMetaSetter,
    RuleNode,
    RuleRegistry,
    RuleSet,
} from "./reconciler-metadata.js";
export {
    GTKX_CONFIG_VIRTUAL_ID,
    RESOLVED_GTKX_CONFIG_VIRTUAL_ID,
    renderGtkxConfigModule,
    type SerializedGtkxConfig,
    serializeGtkxConfig,
} from "./virtual.js";
export {
    BUFFER_TEXT_KIND,
    CONTAINER_SLOT_KIND,
    LABEL_TEXT_KIND,
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    OVERLAY_KIND,
    TAB_LABEL_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
    WIDGET_PROP_KIND,
    WRAPPER_NODE_ELEMENT,
} from "./wrapper-protocol.js";
