export {
    defineConfig,
    GIR_LIBRARY_PATTERN,
    type GtkxConfig,
    LIBRARIES_WILDCARD,
    mergeConfig,
    type ResolvedGtkxConfig,
    type ResolvedReactCompilerOptions,
    resolveReactCompilerOptions,
} from "./config.js";
export { DATA_IMPORT_PREFIX, resolveDataDir } from "./data-dir.js";
export {
    createGtkxConfigLoader,
    type GtkxConfigLoader,
    GtkxConfigNotFoundError,
    loadGtkxConfig,
    loadResolvedGtkxConfig,
} from "./loader.js";
export { createGtkxConfigPlugin } from "./plugin.js";
export {
    type AddMethodRule,
    type AttachShape,
    type AttachShapeTable,
    BUFFER_TEXT_KIND,
    CONTAINER_SLOT_KIND,
    LABEL_TEXT_KIND,
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    type OrderedInsertSpec,
    OVERLAY_KIND,
    type PageMetaSetter,
    RELATIONSHIP_NODE_ELEMENT,
    type RuleNode,
    type RuleRegistry,
    type RuleSet,
    TAB_LABEL_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
    WIDGET_PROP_KIND,
} from "./reconciler.js";
