import type { Plugin } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import createConfigPlugin from "@gtkx/config/vite-plugin";
import { gtkxAssetImports } from "./asset-imports.js";
import { gtkxCss } from "./css.js";
import { gtkxIcons } from "./icons.js";
import { gtkxReactCompiler } from "./react-compiler.js";
import { gtkxResources } from "./resources.js";
import { gtkxSettings } from "./settings.js";
import { gtkxStoreLinks } from "./store-links.js";
import { gtkxUndeclaredLibrary } from "./undeclared-library.js";

const gtkxVitePlugins = (mode?: string): Plugin[] => {
    const loadConfig = createConfigLoader(mode === undefined ? {} : { mode });

    return [
        createConfigPlugin({ name: "gtkx:config", loadConfig }),
        gtkxStoreLinks(),
        gtkxUndeclaredLibrary(loadConfig),
        gtkxSettings(),
        gtkxIcons(),
        gtkxAssetImports(),
        gtkxResources(loadConfig),
        gtkxCss(),
        gtkxReactCompiler(loadConfig),
    ];
};

export { gtkxVitePlugins };
