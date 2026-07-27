import type { Plugin, UserConfig } from "vite";
import { type ConfigLoader, createConfigLoader } from "./loader.js";
import { GTKX_CONFIG_VIRTUAL_ID, renderConfigModule, RESOLVED_GTKX_CONFIG_VIRTUAL_ID } from "./virtual.js";

type PluginState = {
    root: string | undefined;
};

const resolveVirtualId = (id: string): string | null =>
    id === GTKX_CONFIG_VIRTUAL_ID ? RESOLVED_GTKX_CONFIG_VIRTUAL_ID : null;

const loadVirtualModule = async (
    id: string,
    loadConfig: ConfigLoader,
    state: PluginState,
): Promise<string | undefined> => {
    if (id !== RESOLVED_GTKX_CONFIG_VIRTUAL_ID) {
        return undefined;
    }

    return renderConfigModule(await loadConfig(state.root ?? process.cwd()));
};

/**
 * Creates the Vite plugin that resolves and serves the `virtual:gtkx-config`
 * module, exposing the JSX metadata and the resolved application ID from the
 * project's configuration.
 * @param options Plugin name, an optional custom {@link ConfigLoader}, and an
 * optional hook returning extra Vite user config.
 */
const createConfigPlugin = (options: {
    name: string;
    loadConfig?: ConfigLoader;
    config?: () => Omit<UserConfig, "plugins">;
}): Plugin => {
    const loadConfig = options.loadConfig ?? createConfigLoader();
    const state: PluginState = { root: undefined };

    return {
        name: options.name,
        config(config: UserConfig) {
            state.root = config.root ?? state.root;

            return options.config?.();
        },
        resolveId: (id: string) => resolveVirtualId(id),
        load: (id: string) => loadVirtualModule(id, loadConfig, state),
    };
};

export default createConfigPlugin;
