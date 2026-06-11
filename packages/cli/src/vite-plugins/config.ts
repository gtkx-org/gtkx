import {
    createGtkxConfigLoader,
    GTKX_CONFIG_VIRTUAL_ID,
    type GtkxConfigLoader,
    RESOLVED_GTKX_CONFIG_VIRTUAL_ID,
    type ResolvedGtkxConfig,
    renderGtkxConfigModule,
} from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";

/**
 * Vite plugin that serves the `virtual:gtkx-config` module `@gtkx/react`
 * imports and `@gtkx/config/runtime` re-exports verbatim.
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
    let resolved: Promise<ResolvedGtkxConfig> | undefined;

    return {
        name: "gtkx:config",

        config(config: UserConfig) {
            resolved = loadConfig(config.root ?? process.cwd());
        },

        resolveId(id: string) {
            if (id === GTKX_CONFIG_VIRTUAL_ID) return RESOLVED_GTKX_CONFIG_VIRTUAL_ID;
            return undefined;
        },

        async load(id: string) {
            if (id !== RESOLVED_GTKX_CONFIG_VIRTUAL_ID) return undefined;
            return renderGtkxConfigModule(await (resolved ?? loadConfig(process.cwd())));
        },
    };
}
