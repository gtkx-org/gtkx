import type { Plugin } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import createConfigPlugin from "@gtkx/config/vite-plugin";
import type { BuildManifestCollector } from "../internal/build-manifest.js";
import { createProjectStaging, type ProjectStaging } from "../internal/project-staging.js";
import { gtkxAssetImports } from "./asset-imports.js";
import { gtkxBuiltUrl } from "./built-url.js";
import { gtkxCss } from "./css.js";
import { gtkxFont } from "./font.js";
import { type CatalogWriteListener, gtkxI18n } from "./i18n.js";
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
    onCatalogsWritten?: CatalogWriteListener | undefined;
    shouldPreserveI18nMetadata?: boolean | undefined;
    shouldWarnGraduatedFuture?: boolean | undefined;
    staging?: ProjectStaging | undefined;
    localeDir?: string | null | undefined;
};

const gtkxVitePlugins = (options: GtkxVitePluginOptions = {}): Plugin[] => {
    const {
        buildManifest,
        configFile,
        entryPath,
        mode,
        onCatalogsWritten,
        shouldPreserveI18nMetadata = true,
        shouldWarnGraduatedFuture,
        staging = createProjectStaging(),
        localeDir,
    } = options;
    const loadConfig = createConfigLoader({
        ...(mode !== undefined && { mode }),
        ...(configFile !== undefined && { configFile }),
        ...(shouldWarnGraduatedFuture !== undefined && { shouldWarnGraduatedFuture }),
    });

    return [
        createConfigPlugin({ name: "gtkx:config", loadConfig, localeDir }),
        ...(entryPath === undefined
            ? []
            : [
                  gtkxI18n({
                      entryPath,
                      loadConfig,
                      onCatalogsWritten,
                      shouldPreserveMetadataMessages: shouldPreserveI18nMetadata,
                      shouldRecoverExtractionErrors: mode === "development",
                  }),
              ]),
        gtkxStoreLinks(),
        gtkxUndeclaredLibrary(loadConfig),
        gtkxSettings(buildManifest, staging.schemas),
        gtkxIcons(loadConfig),
        gtkxAssetImports(),
        gtkxBuiltUrl(),
        gtkxFont(staging.fonts),
        gtkxResources(loadConfig, entryPath),
        gtkxCss(),
        gtkxReactCompiler(loadConfig),
    ];
};

export { gtkxVitePlugins };
