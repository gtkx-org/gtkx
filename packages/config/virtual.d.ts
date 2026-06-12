/**
 * Ambient declaration for the `virtual:gtkx-config` module rendered by
 * `renderGtkxConfigModule` and served by the gtkx Vite plugins
 * (`gtkx dev`/`gtkx build`) and the `@gtkx/vitest` plugin. The module
 * re-exports the codegen-derived metadata tables from the generated bindings
 * package and carries each field of the project's resolved `gtkx.config.ts`
 * as a named constant, re-exported verbatim by `@gtkx/config/runtime`.
 * `gtkx build` inlines the resolved module into the production bundle, so no
 * plugin is needed at runtime.
 *
 * Consumers pull this declaration in with
 * `/// <reference types="@gtkx/config/virtual" />`, so a TypeScript program
 * spanning several source packages sees a single declaration of the module.
 */
declare module "virtual:gtkx-config" {
    /** Per-GLib-type-name map of `onCamelCase` handler prop names to GIR signal names. */
    export const SIGNALS: Readonly<Record<string, Readonly<Record<string, string>>>>;
    /** Per-GLib-type-name set of construct-only camelCase property names. */
    export const CONSTRUCT_ONLY_PROPS: Readonly<Record<string, ReadonlySet<string>>>;
    /** Per-GLib-type-name map of settable property names to their GIR default value. */
    export const DEFAULT_PROPS: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    /** Merged attach relationships: codegen's built-ins, then the config's `elementMap` rows. */
    export const ELEMENT_MAP: readonly import("@gtkx/config").ElementMapRule[];
    /** Merged array-prop rows keyed by GLib type name, then prop name. */
    export const ARRAY_PROPS: Readonly<Record<string, Readonly<Record<string, import("@gtkx/config").ArrayPropRow>>>>;
    /** Merged object-prop rows keyed by GLib type name, then prop name. */
    export const OBJECT_PROPS: Readonly<Record<string, Readonly<Record<string, import("@gtkx/config").ObjectPropRow>>>>;
    /** Merged virtual-prop rows keyed by GLib type name, then prop name. */
    export const VIRTUAL_PROPS: Readonly<
        Record<string, Readonly<Record<string, import("@gtkx/config").VirtualPropRow>>>
    >;
    /** Imperative and signal prop rules keyed by GLib type name. */
    export const PROP_RULES: Readonly<Record<string, readonly import("@gtkx/config").PropRule[]>>;
    /** GLib type names of top-level surfaces (windows and dialogs). */
    export const TOP_LEVEL_TYPES: readonly string[];
    /** Page-add method priority rows for stack-like parents, keyed by GLib type name. */
    export const META_OBJECT_ADD_METHODS: Readonly<Record<string, readonly import("@gtkx/config").AddMethodRule[]>>;
    /** Page-metadata setters applied to stack page handles. */
    export const PAGE_META_SETTERS: readonly import("@gtkx/config").PageMetaSetter[];
    /** Merged container-slot method names keyed by JSX element name. */
    export const CONTAINER_SLOTS: Readonly<Record<string, readonly string[]>>;
    /** The configured library identifiers, the `"*"` wildcard, or `[]` when omitted. */
    export const libraries: import("@gtkx/config").ResolvedGtkxConfig["libraries"];
    /** Additional GIR search directories, or `[]` when omitted. */
    export const girPath: import("@gtkx/config").ResolvedGtkxConfig["girPath"];
    /** The GLib application id, or `undefined` when unset. */
    export const applicationId: import("@gtkx/config").ResolvedGtkxConfig["applicationId"];
    /** The user's container-slot map, or `{}` when omitted. */
    export const containerSlots: import("@gtkx/config").ResolvedGtkxConfig["containerSlots"];
    /** The user's array-prop rows, or `{}` when omitted. */
    export const arrayProps: import("@gtkx/config").ResolvedGtkxConfig["arrayProps"];
    /** The user's object-prop rows, or `{}` when omitted. */
    export const objectProps: import("@gtkx/config").ResolvedGtkxConfig["objectProps"];
    /** The user's virtual-prop rows, or `{}` when omitted. */
    export const virtualProps: import("@gtkx/config").ResolvedGtkxConfig["virtualProps"];
    /** The user's element-map rows, or `[]` when omitted. */
    export const elementMap: import("@gtkx/config").ResolvedGtkxConfig["elementMap"];
    /** The resolved React Compiler options, or `null` when disabled. */
    export const reactCompiler: import("@gtkx/config").ResolvedGtkxConfig["reactCompiler"];
}
