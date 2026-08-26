import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, ResolvedConfig } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, posix, relative, resolve } from "node:path";
import {
    type CatalogProject,
    compileCatalogs,
    LOCALE_DIRNAME,
    resolveCatalogProject,
    synchronizeCatalogs,
} from "../i18n/catalogs.js";
import { extractSourceCatalog } from "../i18n/source-messages.js";
import { discoverSourceFiles } from "../internal/source-imports.js";
import { stripQuery } from "./strip-query.js";

type I18nState = {
    entryPath: string;
    i18nRoot: string;
    outDir: string;
    project: CatalogProject | null;
};

const BOOTSTRAP_SPECIFIER = "@gtkx/i18n/bootstrap";
const LOCALE_URL_PLACEHOLDER = "__GTKX_BUNDLE_LOCALE_DIR__";
const LOCALE_MODULE_PATHS = new Set(["dist/locale.js", "src/locale.ts"]);
const LOCALE_URL_PATTERN = /new URL\((["'])locale\1,\s*import\.meta\.url\)/;

const isI18nLocaleModule = (state: I18nState, id: string): boolean => {
    if (state.i18nRoot.length === 0) {
        return false;
    }

    const path = relative(state.i18nRoot, stripQuery(id)).replaceAll("\\", "/");

    return LOCALE_MODULE_PATHS.has(path);
};

const markLocaleUrl = (code: string): string =>
    code.replace(
        LOCALE_URL_PATTERN,
        () => `new URL(${JSON.stringify(LOCALE_URL_PLACEHOLDER)}, import.meta.url)`,
    );

const localeUrlForChunk = (fileName: string): string => {
    const path = posix.relative(posix.dirname(fileName), LOCALE_DIRNAME);

    return path.length === 0 ? "." : path;
};

const rebaseLocaleUrl = (state: I18nState, code: string, fileName: string, moduleIds: string[]): string | null => {
    if (moduleIds.every((id) => !isI18nLocaleModule(state, id))) {
        return null;
    }

    const placeholder = JSON.stringify(LOCALE_URL_PLACEHOLDER);

    if (!code.includes(placeholder)) {
        throw new Error(`Unable to locate the @gtkx/i18n locale fallback in ${fileName}`);
    }

    return code.replace(placeholder, () => JSON.stringify(localeUrlForChunk(fileName)));
};

const applyResolvedConfig = async (
    state: I18nState,
    config: ResolvedConfig,
    loadConfig: ConfigLoader,
): Promise<void> => {
    state.entryPath = resolve(config.root, state.entryPath);
    state.outDir = resolve(config.root, config.build.outDir);
    const application = await loadConfig.resolve(config.root);
    state.project = resolveCatalogProject(config.root, application.applicationId);

    if (state.project !== null) {
        const projectRequire = createRequire(resolve(config.root, "package.json"));
        state.i18nRoot = dirname(projectRequire.resolve("@gtkx/i18n/package.json"));
    }
};

const buildCatalogs = (state: I18nState): void => {
    const project = state.project;

    if (project === null) {
        return;
    }

    mkdirSync(state.outDir, { recursive: true });
    compileCatalogs(project, resolve(state.outDir, LOCALE_DIRNAME));
};

const extractProjectMessages = async (
    state: I18nState,
    shouldPreserveMetadataMessages: boolean,
): Promise<void> => {
    const project = state.project;

    if (project === null) {
        return;
    }

    const srcDir = join(project.root, "src");
    const sourceFiles = discoverSourceFiles(existsSync(srcDir) ? srcDir : project.root);
    await extractSourceCatalog(project, sourceFiles, shouldPreserveMetadataMessages);
    synchronizeCatalogs(project);
};

const gtkxI18n = (
    entryPath: string,
    loadConfig: ConfigLoader = createConfigLoader(),
    shouldPreserveMetadataMessages = true,
): Plugin => {
    const state: I18nState = { entryPath, i18nRoot: "", outDir: "", project: null };

    return {
        name: "gtkx:i18n",
        enforce: "pre",

        configResolved: (config) => applyResolvedConfig(state, config, loadConfig),

        buildStart: () => extractProjectMessages(state, shouldPreserveMetadataMessages),

        transform(code, id) {
            if (isI18nLocaleModule(state, id)) {
                return markLocaleUrl(code);
            }

            if (state.project === null || resolve(stripQuery(id)) !== state.entryPath) {
                return;
            }

            return `import ${JSON.stringify(BOOTSTRAP_SPECIFIER)};\n${code}`;
        },

        renderChunk(code, chunk) {
            return rebaseLocaleUrl(state, code, chunk.fileName, chunk.moduleIds);
        },

        generateBundle() {
            buildCatalogs(state);
        },
    };
};

export { gtkxI18n };
