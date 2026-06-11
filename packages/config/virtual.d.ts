/**
 * Ambient declaration for the `virtual:gtkx-config` module rendered by
 * `renderGtkxConfigModule` and served by the gtkx Vite plugins
 * (`gtkx dev`/`gtkx build`) and the `@gtkx/vitest` plugin. The module
 * re-exports the codegen-derived metadata tables from the generated bindings
 * package and carries the project's resolved `gtkx.config.ts`. `gtkx build`
 * inlines the resolved module into the production bundle, so no plugin is
 * needed at runtime.
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
    /** Merged widget-slot property names keyed by JSX element name. */
    export const SLOTS: Readonly<Record<string, readonly string[]>>;
    /** Merged container-slot method names keyed by JSX element name. */
    export const CONTAINER_SLOTS: Readonly<Record<string, readonly string[]>>;
    /** The project's resolved `gtkx.config.ts`. */
    export const config: import("@gtkx/config").ResolvedGtkxConfig;
}
