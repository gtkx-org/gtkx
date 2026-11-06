import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, ResolvedConfig, Rollup } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import { isPathWithin, logger, toPosixPath } from "@gtkx/utils";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, posix, relative, resolve } from "node:path";
import { I18N_RUNTIME_CONFIG_FILENAME, renderI18nRuntimeConfig } from "../i18n/runtime-config.js";
import {
    type CatalogProject,
    compileCatalogs,
    LOCALE_DIRNAME,
    resolveCatalogProject,
    synchronizeCatalogs,
    type WrittenCatalog,
} from "../i18n/catalogs.js";
import { extractSourceCatalog, SourceExtractionError } from "../i18n/source-messages.js";
import { emitI18nTypes } from "../i18n/types.js";
import { discoverSourceFilesIn, sourceLanguage } from "../internal/source-imports.js";
import { packageForModule } from "./build-manifest.js";
import { ESM_EXTENSION } from "./esm-extension.js";
import { stripQuery } from "./strip-query.js";

type CatalogWriteListener = (catalogs: WrittenCatalog[]) => void;

type I18nPluginOptions = {
    entryPath: string;
    loadConfig?: ConfigLoader | undefined;
    onCatalogsWritten?: CatalogWriteListener | undefined;
    shouldPreserveMetadataMessages?: boolean | undefined;
    shouldRecoverExtractionErrors?: boolean | undefined;
};

type I18nState = {
    entryPath: string;
    entryBootstrap: string;
    bootstrapFileName: string;
    isBuild: boolean;
    entryLoadsRuntime: boolean;
    i18nRoot: string;
    outDir: string;
    project: CatalogProject | null;
    extraction: Promise<void>;
    hotUpdateTimestamp: number | null;
    onCatalogsWritten: CatalogWriteListener;
};

const BOOTSTRAP_SPECIFIER = "@gtkx/i18n/bootstrap";
const ENTRY_BOOTSTRAP_ID = "\0gtkx-entry-bootstrap";
const ENTRY_BOOTSTRAP_STEM = "entry-bootstrap";
const RUNTIME_PACKAGE = "@gtkx/runtime";
const HASHBANG = /^#!.*\n?/;
const PROGRAM_NAME_SPECIFIER = "@gtkx/react/program-name";
const PROGRAM_NAME_PACKAGES = ["@gtkx/react", "@gtkx/gi"];
const LOCALE_URL_PLACEHOLDER = "__GTKX_BUNDLE_LOCALE_CONFIG__";
const LOCALE_MODULE_PATHS = new Set(["dist/locale.js", "src/locale.ts"]);
const LOCALE_URL_PATTERN = /new URL\((["'])gtkx-i18n\.json\1,\s*import\.meta\.url\)/;

const isI18nLocaleModule = (state: I18nState, id: string): boolean => {
    if (state.i18nRoot.length === 0) {
        return false;
    }

    const path = toPosixPath(relative(state.i18nRoot, stripQuery(id)));

    return LOCALE_MODULE_PATHS.has(path);
};

const markLocaleUrl = (code: string): string =>
    code.replace(LOCALE_URL_PATTERN, () => `new URL(${JSON.stringify(LOCALE_URL_PLACEHOLDER)}, import.meta.url)`);

const localeUrlForChunk = (fileName: string): string => {
    const path = posix.relative(posix.dirname(fileName), I18N_RUNTIME_CONFIG_FILENAME);

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

const isRuntimeModule = (id: string): boolean => packageForModule(id)?.manifest.name === RUNTIME_PACKAGE;

const loadsRuntime = (context: Rollup.PluginContext, entryId: string): boolean => {
    const seen = new Set<string>();
    const pending = [entryId];

    for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
        if (seen.has(id)) {
            continue;
        }

        if (isRuntimeModule(id)) {
            return true;
        }

        seen.add(id);
        const info = context.getModuleInfo(id);
        pending.push(...(info?.importedIds ?? []), ...(info?.dynamicallyImportedIds ?? []));
    }

    return false;
};

const isEntryModule = (state: I18nState, id: string): boolean => resolve(stripQuery(id)) === state.entryPath;

const importSpecifier = (fromFileName: string, toFileName: string): string => {
    const path = posix.relative(posix.dirname(fromFileName), toFileName);

    return path.startsWith(".") ? path : `./${path}`;
};

const prependStatement = (code: string, statement: string): string => {
    const hashbang = HASHBANG.exec(code)?.[0] ?? "";

    return hashbang + statement + code.slice(hashbang.length);
};

const importBootstrap = (state: I18nState, code: string, chunk: Rollup.RenderedChunk): string | null =>
    state.entryLoadsRuntime &&
    chunk.isEntry &&
    chunk.facadeModuleId !== null &&
    isEntryModule(state, chunk.facadeModuleId)
        ? prependStatement(code, `import ${JSON.stringify(importSpecifier(chunk.fileName, state.bootstrapFileName))};`)
        : null;

const hasPackage = (projectRequire: NodeJS.Require, name: string): boolean => {
    try {
        projectRequire.resolve(`${name}/package.json`);
        return true;
    } catch {
        return false;
    }
};

const applyResolvedConfig = async (
    state: I18nState,
    config: ResolvedConfig,
    loadConfig: ConfigLoader,
): Promise<void> => {
    state.entryPath = resolve(config.root, state.entryPath);
    state.outDir = resolve(config.root, config.build.outDir);
    state.isBuild = config.command === "build";
    state.bootstrapFileName = posix.join(config.build.assetsDir, ENTRY_BOOTSTRAP_STEM + ESM_EXTENSION);
    const application = await loadConfig.resolve(config.root);
    state.project = resolveCatalogProject(config.root, application.translationDomain);
    const projectRequire = createRequire(resolve(config.root, "package.json"));

    if (state.project !== null) {
        state.i18nRoot = dirname(projectRequire.resolve("@gtkx/i18n/package.json"));
    }

    state.entryBootstrap = [
        ...(PROGRAM_NAME_PACKAGES.every((name) => hasPackage(projectRequire, name)) ? [PROGRAM_NAME_SPECIFIER] : []),
        ...(state.project === null ? [] : [BOOTSTRAP_SPECIFIER]),
    ]
        .map((specifier) => `import ${JSON.stringify(specifier)};\n`)
        .join("");
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
    shouldSynchronizeCatalogs: boolean,
): Promise<void> => {
    const project = state.project;

    if (project === null) {
        return;
    }

    const sourceFiles = discoverSourceFilesIn(project.sourceDirs);
    await extractSourceCatalog(project, sourceFiles, shouldPreserveMetadataMessages);

    if (shouldSynchronizeCatalogs) {
        state.onCatalogsWritten(synchronizeCatalogs(project));
    }

    await emitI18nTypes(project.root);
};

const settleExtraction = async (pending: Promise<void>): Promise<void> => {
    try {
        await pending;
    } catch {
        return;
    }
};

const queueExtraction = (
    state: I18nState,
    shouldPreserveMetadataMessages: boolean,
    shouldSynchronizeCatalogs: boolean,
): Promise<void> => {
    const prior = state.extraction;
    const pending = (async (): Promise<void> => {
        await settleExtraction(prior);
        await extractProjectMessages(state, shouldPreserveMetadataMessages, shouldSynchronizeCatalogs);
    })();

    state.extraction = pending;

    return pending;
};

const isProjectSource = (state: I18nState, path: string): boolean => {
    const project = state.project;

    if (project === null || sourceLanguage(path) === undefined) {
        return false;
    }

    return project.sourceDirs.some((dir) => isPathWithin(dir, path));
};

const refreshProjectMessages = async (
    state: I18nState,
    shouldPreserveMetadataMessages: boolean,
    shouldSynchronizeCatalogs = false,
): Promise<void> => {
    try {
        await queueExtraction(state, shouldPreserveMetadataMessages, shouldSynchronizeCatalogs);
    } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
    }
};

const recoverInitialSourceExtraction = async (
    state: I18nState,
    shouldPreserveMetadataMessages: boolean,
): Promise<void> => {
    try {
        await queueExtraction(state, shouldPreserveMetadataMessages, true);
    } catch (error) {
        if (!(error instanceof SourceExtractionError)) {
            throw error;
        }

        logger.error(error.message);
    }
};

const gtkxI18n = ({
    entryPath,
    loadConfig = createConfigLoader(),
    onCatalogsWritten = (): void => undefined,
    shouldPreserveMetadataMessages = true,
    shouldRecoverExtractionErrors = false,
}: I18nPluginOptions): Plugin => {
    const state: I18nState = {
        entryPath,
        entryBootstrap: "",
        bootstrapFileName: "",
        isBuild: false,
        entryLoadsRuntime: false,
        extraction: Promise.resolve(),
        hotUpdateTimestamp: null,
        i18nRoot: "",
        outDir: "",
        project: null,
        onCatalogsWritten,
    };

    return {
        name: "gtkx:i18n",
        enforce: "pre",

        configResolved: (config) => applyResolvedConfig(state, config, loadConfig),

        buildStart() {
            if (state.isBuild && state.entryBootstrap.length > 0) {
                this.emitFile({ type: "chunk", id: ENTRY_BOOTSTRAP_ID, fileName: state.bootstrapFileName });
            }

            return shouldRecoverExtractionErrors
                ? recoverInitialSourceExtraction(state, shouldPreserveMetadataMessages)
                : queueExtraction(state, shouldPreserveMetadataMessages, true);
        },

        resolveId(source) {
            return source === ENTRY_BOOTSTRAP_ID ? ENTRY_BOOTSTRAP_ID : null;
        },

        load(id) {
            return id === ENTRY_BOOTSTRAP_ID ? state.entryBootstrap : null;
        },

        buildEnd() {
            const entryId = [...this.getModuleIds()].find(
                (id) => id !== ENTRY_BOOTSTRAP_ID && isEntryModule(state, id),
            );
            state.entryLoadsRuntime =
                state.isBuild &&
                state.entryBootstrap.length > 0 &&
                entryId !== undefined &&
                loadsRuntime(this, entryId);
        },

        hotUpdate(options) {
            if (!isProjectSource(state, options.file) || state.hotUpdateTimestamp === options.timestamp) {
                return;
            }

            state.hotUpdateTimestamp = options.timestamp;

            return refreshProjectMessages(state, shouldPreserveMetadataMessages);
        },

        transform(code, id) {
            if (isI18nLocaleModule(state, id)) {
                return markLocaleUrl(code);
            }

            if (state.isBuild || state.entryBootstrap.length === 0 || !isEntryModule(state, id)) {
                return;
            }

            return state.entryBootstrap + code;
        },

        renderChunk(code, chunk) {
            const rebased = rebaseLocaleUrl(state, code, chunk.fileName, chunk.moduleIds);

            return importBootstrap(state, rebased ?? code, chunk) ?? rebased;
        },

        generateBundle(_options, bundle) {
            if (state.isBuild && !state.entryLoadsRuntime) {
                Reflect.deleteProperty(bundle, state.bootstrapFileName);
            }

            buildCatalogs(state);
            if (state.project !== null) {
                this.emitFile({
                    type: "asset",
                    fileName: I18N_RUNTIME_CONFIG_FILENAME,
                    source: renderI18nRuntimeConfig(LOCALE_DIRNAME),
                });
            }
        },
    };
};

export { type CatalogWriteListener, gtkxI18n };
