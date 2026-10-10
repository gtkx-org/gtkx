import type { Plugin, UserConfig } from "vite";
import { resolve } from "node:path";
import { type ConfigLoader, createConfigLoader } from "./loader.ts";
import { GTKX_CONFIG_VIRTUAL_ID, renderConfigModule, RESOLVED_GTKX_CONFIG_VIRTUAL_ID } from "./virtual.ts";
import { viteProjectRoot } from "./vite-root.ts";

type PluginState = {
    root: string;
};

const VIRTUAL_ID_RE = new RegExp(`^${GTKX_CONFIG_VIRTUAL_ID}$`);
const RESOLVED_VIRTUAL_ID_RE = new RegExp(`^${RESOLVED_GTKX_CONFIG_VIRTUAL_ID}$`);

const resolveVirtualId = (id: string): string | null =>
    id === GTKX_CONFIG_VIRTUAL_ID ? RESOLVED_GTKX_CONFIG_VIRTUAL_ID : null;

const loadVirtualModule = async (
    id: string,
    loadConfig: ConfigLoader,
    state: PluginState,
    localeDir: string | null | undefined,
): Promise<string | undefined> => {
    if (id !== RESOLVED_GTKX_CONFIG_VIRTUAL_ID) {
        return undefined;
    }

    return renderConfigModule(
        await loadConfig.resolve(state.root),
        localeDir == null ? null : resolve(state.root, localeDir),
    );
};

/**
 * Creates a Vite plugin serving `virtual:gtkx-config`, the module carrying the project's resolved
 * `gtkx.config.ts`.
 */
const createConfigPlugin = (options: {
    /** Name the plugin is registered under in Vite. */
    name: string;
    /** Loader the configuration is resolved through, defaulting to a fresh caching loader. */
    loadConfig?: ConfigLoader;
    /** Catalog directory for development or tests, resolved relative to the project root. */
    localeDir?: string | null | undefined;
    /** Extra Vite configuration contributed from the plugin's `config` hook, given the user's own configuration. */
    config?: (config: UserConfig) => Omit<UserConfig, "plugins">;
}): Plugin => {
    const loadConfig = options.loadConfig ?? createConfigLoader();
    const state: PluginState = { root: process.cwd() };

    return {
        name: options.name,
        config(config: UserConfig) {
            state.root = viteProjectRoot(config);

            return options.config?.(config);
        },
        resolveId: {
            filter: { id: VIRTUAL_ID_RE },
            handler: (id: string) => resolveVirtualId(id),
        },
        load: {
            filter: { id: RESOLVED_VIRTUAL_ID_RE },
            handler: (id: string) => loadVirtualModule(id, loadConfig, state, options.localeDir),
        },
    };
};

export default createConfigPlugin;
