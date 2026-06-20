import { createGtkxConfigLoader, createGtkxConfigPlugin, type GtkxConfigLoader } from "@gtkx/config";
import type { Plugin } from "vite";

/**
 * Vite plugin that serves the `virtual:gtkx-config` module that `@gtkx/react`
 * and app code import.
 *
 * The module re-exports the codegen-derived metadata tables (`SIGNALS`,
 * `CONSTRUCT_ONLY_PROPS`, `DEFAULT_PROPS`) from the generated `@gtkx/jsx`
 * package and carries each field of the project's resolved `gtkx.config.ts`
 * as a named constant. Delivering them through a virtual module keeps
 * `@gtkx/react` free of any dependency on `@gtkx/jsx`: the metadata flows in
 * through the bundler instead of a package import, so the dependency graph
 * stays one-way (`@gtkx/jsx` → `@gtkx/react`). `gtkx build` resolves and
 * inlines the module into the production bundle, so no plugin is needed at
 * runtime.
 *
 * @param loadConfig - Memoizing config loader, shared with the other gtkx
 *   plugins by `gtkxVitePlugins` so the pipeline loads `gtkx.config.ts` once.
 * @returns The `gtkx:config` Vite plugin.
 */
export function gtkxConfig(loadConfig: GtkxConfigLoader = createGtkxConfigLoader()): Plugin {
    return createGtkxConfigPlugin({ name: "gtkx:config", loadConfig });
}
