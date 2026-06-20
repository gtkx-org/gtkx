import { createGtkxConfigLoader } from "@gtkx/config";
import type { Plugin } from "vite";
import { gtkxAssets } from "./assets.js";
import { gtkxConfig } from "./config.js";
import { gtkxResources } from "./gresources.js";
import { gtkxGSettings } from "./gsettings.js";
import { gtkxReactCompiler } from "./react-compiler.js";

export const gtkxVitePlugins = (): Plugin[] => {
    const loadConfig = createGtkxConfigLoader();
    return [
        gtkxConfig(loadConfig),
        gtkxGSettings(),
        gtkxResources(loadConfig),
        gtkxAssets(),
        gtkxReactCompiler(loadConfig),
    ];
};
