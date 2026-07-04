import { createGtkxConfigLoader } from "@gtkx/config";
import { createGtkxConfigPlugin } from "@gtkx/config/plugin";
import type { Plugin } from "vite";
import { gtkxAssets } from "./assets.js";
import { gtkxGResources } from "./gresources.js";
import { gtkxGSettings } from "./gsettings.js";
import { gtkxReactCompiler } from "./react-compiler.js";

export const gtkxVitePlugins = (mode?: string): Plugin[] => {
    const loadConfig = createGtkxConfigLoader(mode !== undefined ? { mode } : {});
    return [
        createGtkxConfigPlugin({ name: "gtkx:config", loadConfig }),
        gtkxGSettings(),
        gtkxGResources(loadConfig),
        gtkxAssets(),
        gtkxReactCompiler(loadConfig),
    ];
};
