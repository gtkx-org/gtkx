/**
 * Ambient declaration for the `virtual:gtkx-config` module the gtkx Vite plugin
 * serves. It re-exports the codegen-derived metadata tables from `@gtkx/react-gi`
 * and the project's resolved `gtkx.config.ts` values, so `@gtkx/react` reads them
 * without depending on the generated package. `gtkx build` inlines the resolved
 * module into the production bundle.
 */
declare module "virtual:gtkx-config" {
    /** Per-GLib-type-name map of `onCamelCase` handler prop names to GIR signal names. */
    export const SIGNALS: Readonly<Record<string, Readonly<Record<string, string>>>>;
    /** Per-GLib-type-name set of construct-only camelCase property names. */
    export const CONSTRUCT_ONLY_PROPS: Readonly<Record<string, ReadonlySet<string>>>;
    /** Per-GLib-type-name map of settable property names to their GIR default value. */
    export const DEFAULT_PROPS: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    /** The GLib application id from `gtkx.config.ts`, or `undefined` when unset. */
    export const applicationId: string | undefined;
}
