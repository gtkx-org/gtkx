import { createConfigLoader } from "@gtkx/config/internal";
import createConfigPlugin from "@gtkx/config/vite-plugin";
import type { Plugin } from "vite";
import { gtkxAssets } from "./css.js";
import { gtkxGResources } from "./gresources.js";
import { gtkxGSettings } from "./gsettings.js";
import { gtkxReactCompiler } from "./react-compiler.js";

export const gtkxVitePlugins = (mode?: string): Plugin[] => {
    const loadConfig = createConfigLoader(mode !== undefined ? { mode } : {});
    return [
        createConfigPlugin({ name: "gtkx:config", loadConfig }),
        gtkxGSettings(),
        gtkxGResources(loadConfig),
        gtkxAssets(),
        gtkxReactCompiler(loadConfig),
    ];
};
