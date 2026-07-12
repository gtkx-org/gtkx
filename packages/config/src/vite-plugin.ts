import type { Plugin, UserConfig } from "vite";
import { type ConfigLoader, createConfigLoader } from "./loader.js";
import { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID, renderConfigModule } from "./virtual.js";

/**
 * Creates the Vite plugin that resolves and serves the `virtual:gtkx-config`
 * module, exposing the JSX metadata and the resolved application id from the
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
    let root: string | undefined;

    return {
        name: options.name,
        config(config: UserConfig) {
            root = config.root ?? root;
            return options.config?.();
        },
        resolveId(id: string) {
            if (id === GTKX_CONFIG_VIRTUAL_ID) return RESOLVED_GTKX_CONFIG_VIRTUAL_ID;
            return undefined;
        },
        async load(id: string) {
            if (id !== RESOLVED_GTKX_CONFIG_VIRTUAL_ID) return undefined;
            return renderConfigModule(await loadConfig(root ?? process.cwd()));
        },
    };
};

export default createConfigPlugin;
