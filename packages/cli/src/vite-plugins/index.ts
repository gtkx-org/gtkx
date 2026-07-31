import type { Plugin } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import createConfigPlugin from "@gtkx/config/vite-plugin";
import { gtkxCss } from "./css.js";
import { gtkxIcons } from "./icons.js";
import { gtkxReactCompiler } from "./react-compiler.js";
import { gtkxResources } from "./resources.js";
import { gtkxSettings } from "./settings.js";
import { gtkxUndeclaredLibrary } from "./undeclared-library.js";

const gtkxVitePlugins = (mode?: string): Plugin[] => {
    const loadConfig = createConfigLoader(mode === undefined ? {} : { mode });

    return [
        createConfigPlugin({ name: "gtkx:config", loadConfig }),
        gtkxUndeclaredLibrary(loadConfig),
        gtkxSettings(),
        gtkxIcons(),
        gtkxResources(loadConfig),
        gtkxCss(),
        gtkxReactCompiler(loadConfig),
    ];
};

export { gtkxVitePlugins };
