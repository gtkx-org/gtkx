import { createGtkxConfigLoader } from "@gtkx/config";
import type { Plugin } from "vite";
import { gtkxAssets } from "./assets.js";
import { gtkxConfig } from "./config.js";
import { gtkxGResources } from "./gresources.js";
import { gtkxGSettings } from "./gsettings.js";
import { gtkxReactCompiler } from "./react-compiler.js";

export const gtkxVitePlugins = (): Plugin[] => {
    const loadConfig = createGtkxConfigLoader();
    return [
        gtkxConfig(loadConfig),
        gtkxGSettings(),
        gtkxGResources(loadConfig),
        gtkxAssets(),
        gtkxReactCompiler(loadConfig),
    ];
};
