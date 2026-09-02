import type { Plugin } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import createConfigPlugin from "@gtkx/config/vite-plugin";
import type { BuildManifestCollector } from "../internal/build-manifest.js";
import { gtkxAssetImports } from "./asset-imports.js";
import { gtkxBuiltUrl } from "./built-url.js";
import { gtkxCss } from "./css.js";
import { gtkxI18n } from "./i18n.js";
import { gtkxIcons } from "./icons.js";
import { gtkxReactCompiler } from "./react-compiler.js";
import { gtkxResources } from "./resources.js";
import { gtkxSettings } from "./settings.js";
import { gtkxStoreLinks } from "./store-links.js";
import { gtkxUndeclaredLibrary } from "./undeclared-library.js";

type GtkxVitePluginOptions = {
    buildManifest?: BuildManifestCollector | undefined;
    configFile?: string | undefined;
    entryPath?: string | undefined;
    mode?: string | undefined;
    shouldPreserveI18nMetadata?: boolean | undefined;
};

const gtkxVitePlugins = (options: GtkxVitePluginOptions = {}): Plugin[] => {
    const { buildManifest, configFile, entryPath, mode, shouldPreserveI18nMetadata = true } = options;
    const loadConfig = createConfigLoader({
        ...(mode !== undefined && { mode }),
        ...(configFile !== undefined && { configFile }),
    });

    return [
        createConfigPlugin({ name: "gtkx:config", loadConfig }),
        ...(entryPath === undefined ? [] : [gtkxI18n(entryPath, loadConfig, shouldPreserveI18nMetadata)]),
        gtkxStoreLinks(),
        gtkxUndeclaredLibrary(loadConfig),
        gtkxSettings(buildManifest),
        gtkxIcons(loadConfig),
        gtkxAssetImports(),
        gtkxBuiltUrl(),
        gtkxResources(loadConfig, entryPath),
        gtkxCss(),
        gtkxReactCompiler(loadConfig),
    ];
};

export { gtkxVitePlugins };
