import { createGtkxConfigLoader } from "@gtkx/config";
import { createGtkxConfigPlugin } from "@gtkx/config/plugin";
import type { Plugin } from "vite";
import { gtkxAssets } from "./assets.js";
import { gtkxGResources } from "./gresources.js";
import { gtkxGSettings } from "./gsettings.js";
import { gtkxReactCompiler } from "./react-compiler.js";

export const gtkxVitePlugins = (): Plugin[] => {
    const loadConfig = createGtkxConfigLoader();
    return [
        createGtkxConfigPlugin({ name: "gtkx:config", loadConfig }),
        gtkxGSettings(),
        gtkxGResources(loadConfig),
        gtkxAssets(),
        gtkxReactCompiler(loadConfig),
    ];
};
