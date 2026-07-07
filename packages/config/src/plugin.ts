import type { Plugin, UserConfig } from "vite";
import { createGtkxConfigLoader, type GtkxConfigLoader } from "./loader.js";
import { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID, renderGtkxConfigModule } from "./virtual.js";

export const createGtkxConfigPlugin = (options: {
    name: string;
    loadConfig?: GtkxConfigLoader;
    config?: () => Omit<UserConfig, "plugins">;
}): Plugin => {
    const loadConfig = options.loadConfig ?? createGtkxConfigLoader();
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
            return renderGtkxConfigModule(await loadConfig(root ?? process.cwd()));
        },
    };
};
