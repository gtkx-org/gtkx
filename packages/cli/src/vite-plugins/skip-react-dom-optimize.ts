import type { Plugin } from "vite";

/**
 * Strips `react-dom` and any `react-dom/*` subpath entries from
 * `optimizeDeps.include`.
 *
 * GTKX renders through a Node-side reconciler that never loads React's DOM
 * runtime; pre-bundling those entries would only produce dead bundles and
 * confusing dev-time imports. The plugin runs with `enforce: "post"` so it
 * sees the fully merged Vite configuration, including entries added by other
 * plugins and by the user's `vite.config`.
 *
 * @returns A Vite plugin that mutates `config.optimizeDeps.include` in place.
 */
export const gtkxSkipReactDomOptimize = (): Plugin => ({
    name: "gtkx:skip-react-dom-optimize",
    enforce: "post",
    config(config) {
        config.optimizeDeps ??= {};
        config.optimizeDeps.include = config.optimizeDeps.include?.filter(
            (dep) => dep !== "react-dom" && !dep.startsWith("react-dom/"),
        );
    },
});
