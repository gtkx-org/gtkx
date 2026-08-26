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

const gtkxVitePlugins = (
    mode?: string,
    entryPath?: string,
    buildManifest?: BuildManifestCollector,
    shouldPreserveI18nMetadata = true,
): Plugin[] => {
    const loadConfig = createConfigLoader(mode === undefined ? {} : { mode });

    return [
        createConfigPlugin({ name: "gtkx:config", loadConfig }),
        ...(entryPath === undefined ? [] : [gtkxI18n(entryPath, loadConfig, shouldPreserveI18nMetadata)]),
        gtkxStoreLinks(),
        gtkxUndeclaredLibrary(loadConfig),
        gtkxSettings(loadConfig, buildManifest),
        gtkxIcons(loadConfig),
        gtkxAssetImports(loadConfig),
        gtkxBuiltUrl(),
        gtkxResources(loadConfig, entryPath),
        gtkxCss(),
        gtkxReactCompiler(loadConfig),
    ];
};

export { gtkxVitePlugins };
