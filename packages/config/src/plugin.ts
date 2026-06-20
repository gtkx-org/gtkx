import type { Plugin, UserConfig } from "vite";
import { createGtkxConfigLoader, type GtkxConfigLoader } from "./loader.js";
import { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID, renderGtkxConfigModule } from "./virtual.js";

/**
 * Options for {@link createGtkxConfigPlugin}.
 */
export interface GtkxConfigPluginOptions {
    /** The Vite plugin `name`. */
    readonly name: string;
    /**
     * Memoizing config loader. Defaults to a fresh {@link createGtkxConfigLoader};
     * pass a shared loader so a pipeline loads `gtkx.config.ts` once across its
     * plugins.
     */
    readonly loadConfig?: GtkxConfigLoader;
    /**
     * Extra `config` hook layered on top of the plugin's own root capture. Its
     * returned config is merged into Vite's; the plugin captures `config.root`
     * before calling it so the virtual module loads from the project root.
     */
    readonly config?: (config: UserConfig) => Omit<UserConfig, "plugins"> | null | undefined;
}

/**
 * Builds the Vite plugin that serves the `virtual:gtkx-config` module.
 *
 * The plugin resolves {@link GTKX_CONFIG_VIRTUAL_ID} to its `\0`-prefixed
 * resolved id and loads it by rendering the project's resolved `gtkx.config.ts`
 * through {@link renderGtkxConfigModule}. The config file is read lazily, once
 * per project root, through the memoizing loader — so the combined GTKX
 * pipeline, whose plugins share one loader, never loads it twice. A project
 * without a config file receives the empty resolved config.
 *
 * The returned literal is a plain `vite` `Plugin`; `vitest/config` re-exports
 * the same `Plugin` type, so the object is structurally usable as either.
 *
 * @param options - Plugin name, optional shared loader, and an optional extra
 *   `config` hook for callers that need to contribute further Vite config.
 * @returns The `virtual:gtkx-config` Vite plugin.
 */
export const createGtkxConfigPlugin = (options: GtkxConfigPluginOptions): Plugin => {
    const loadConfig = options.loadConfig ?? createGtkxConfigLoader();
    let root: string | undefined;

    return {
        name: options.name,
        config(config: UserConfig) {
            root = config.root ?? root;
            return options.config?.(config) ?? undefined;
        },
        resolveId(id: string) {
            if (id === GTKX_CONFIG_VIRTUAL_ID) return RESOLVED_GTKX_CONFIG_VIRTUAL_ID;
            return undefined;
        },
        async load(id: string) {
            if (id !== RESOLVED_GTKX_CONFIG_VIRTUAL_ID) return undefined;
            return renderGtkxConfigModule(await loadConfig(root ?? process.cwd()));
        },
    };
};
