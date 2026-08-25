import type { ConfigLoader } from "@gtkx/config";
import type { ModuleNode, Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";
import { error, errorMessage, info, sortStrings } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { BuildManifestCollector } from "../internal/build-manifest.js";
import type { AssetEmitter } from "./asset-emitter.js";
import { prependBanner } from "../internal/banner.js";
import { resolveDataDir } from "../internal/data-dir.js";
import { createRetainedStagingDir, type RetainedStagingDir, withStagingDir } from "../internal/staging-dir.js";
import { compileSchemas } from "../settings/compile.js";
import { parseSchemaXml, SchemaParseError } from "../settings/parser.js";
import { renderRuntimeModule } from "../settings/render.js";
import {
    assertUniqueSchemaBasenames,
    emitSchemaEnv,
    prependSchemaDir,
    projectRelativeSchemaPath,
    SCHEMA_SUFFIX,
    stageSchema,
} from "../settings/schema.js";
import { createVirtualNamespace } from "./virtual-module.js";

type PluginState = {
    schemaDir: RetainedStagingDir;
    rootDir: string | null;
    dataDir: string | null;
    isV2ResourceImports: boolean;
    isBuild: boolean;
    schemaEnvTimer: ReturnType<typeof setTimeout> | null;
    trackedSchemas: Map<string, string>;
    buildSchemas: Set<string>;
};

type PluginContext = AssetEmitter & {
    error: (message: string) => never;
};

const VIRTUAL_PREFIX = "\0gtkx-settings:";
const SCHEMA_STAGING_PREFIX = "schemas";
const SOURCE_MODULE_RE = /\.[cm]?[jt]sx?$/;
const SCHEMA_ENV_DEBOUNCE_MS = 50;
const { isVirtual, fromVirtualId, resolveToVirtual } = createVirtualNamespace(VIRTUAL_PREFIX);

const SCHEMA_ENV_BANNER = [
    "process.env.GSETTINGS_SCHEMA_DIR = [",
    "    decodeURIComponent(new URL(\".\", import.meta.url).pathname),",
    "    process.env.GSETTINGS_SCHEMA_DIR,",
    "]",
    "    .filter(Boolean)",
    "    .join(\":\");",
].join("\n");

const ensureSchemaDir = (state: PluginState): string => {
    const existing = state.schemaDir.getPath();

    if (existing !== null) {
        return existing;
    }

    const runnerDir = process.env.GTKX_DEV_SCHEMA_DIR;

    return runnerDir ? state.schemaDir.adopt(runnerDir) : state.schemaDir.retain();
};

const compileSchemaDir = (state: PluginState): void => {
    const dir = state.schemaDir.getPath();

    if (dir === null) {
        return;
    }

    compileSchemas(dir);
    process.env.GSETTINGS_SCHEMA_DIR = prependSchemaDir(dir, process.env.GSETTINGS_SCHEMA_DIR);
};

const syncSchemaEnv = (state: PluginState): void => {
    if (state.rootDir === null) {
        return;
    }

    try {
        emitSchemaEnv(state.rootDir, state.dataDir, state.isV2ResourceImports);
    } catch (error_) {
        error(`Failed to generate GSettings schema types: ${errorMessage(error_)}`);
    }
};

const cancelSchemaEnvSync = (state: PluginState): void => {
    if (state.schemaEnvTimer === null) {
        return;
    }

    clearTimeout(state.schemaEnvTimer);
    state.schemaEnvTimer = null;
};

const scheduleSchemaEnvSync = (state: PluginState): void => {
    cancelSchemaEnvSync(state);

    state.schemaEnvTimer = setTimeout(() => {
        state.schemaEnvTimer = null;
        syncSchemaEnv(state);
    }, SCHEMA_ENV_DEBOUNCE_MS);
};

const applyUserConfig = async (state: PluginState, config: UserConfig, loadConfig: ConfigLoader): Promise<void> => {
    const loaded = await loadConfig.load(config.root ?? process.cwd());
    state.isV2ResourceImports = loaded.config.future?.v2ResourceImports === true;
    state.dataDir = state.isV2ResourceImports ? null : resolveDataDir(loaded.root);
};

const applyResolvedConfig = (state: PluginState, config: ResolvedConfig): void => {
    state.isBuild = config.command === "build";
    state.rootDir = typeof config.root === "string" ? config.root : null;
    syncSchemaEnv(state);
};

const registerSchemaForMode = (state: PluginState, filePath: string, id: string): void => {
    const fileName = basename(filePath);

    if (state.isBuild) {
        state.buildSchemas.add(filePath);
        info(`Queued GSettings schema: ${fileName}`);

        return;
    }

    state.trackedSchemas.set(filePath, id);
    const dir = ensureSchemaDir(state);
    stageSchema(dir, filePath);
    compileSchemaDir(state);
    info(`Compiled GSettings schema: ${fileName}`);
};

const loadSchemaModule = (ctx: PluginContext, state: PluginState, id: string): string | undefined => {
    if (!isVirtual(id)) {
        return undefined;
    }

    const filePath = fromVirtualId(id);
    const xml = readFileSync(filePath, "utf8");
    const fileName = basename(filePath);
    registerSchemaForMode(state, filePath, id);
    let parsed: ReturnType<typeof parseSchemaXml>;

    try {
        parsed = parseSchemaXml(xml, fileName);
    } catch (error) {
        if (!(error instanceof SchemaParseError)) {
            throw error;
        }

        ctx.error(error.message);
    }

    if (parsed.schemas.length === 0) {
        ctx.error(`No <schema id="..."> found in ${fileName}`);
    }

    return renderRuntimeModule(parsed);
};

const compileBuildSchemas = (schemaFiles: string[]): Buffer =>
    withStagingDir("schemas-build", (dir) => {
        for (const filePath of schemaFiles) {
            stageSchema(dir, filePath);
        }

        compileSchemas(dir);

        return readFileSync(join(dir, "gschemas.compiled"));
    });

const buildSchemaPaths = (rootDir: string, schemaFiles: string[]): string[] =>
    schemaFiles.map((filePath) => {
        const rel = projectRelativeSchemaPath(rootDir, filePath);

        if (rel === null) {
            throw new Error(`Cannot package the GSettings schema ${filePath}: it is outside ${rootDir}`);
        }

        return rel;
    });

const emitBuildSchemas = (
    ctx: PluginContext,
    state: PluginState,
    buildManifest: BuildManifestCollector | undefined,
): void => {
    if (!state.isBuild || state.rootDir === null) {
        return;
    }

    const rootDir = state.rootDir;
    const schemaFiles = sortStrings(state.buildSchemas);
    assertUniqueSchemaBasenames(schemaFiles);
    const schemas = buildSchemaPaths(rootDir, schemaFiles);

    if (buildManifest !== undefined) {
        buildManifest.schemas = schemas;
    }

    if (schemaFiles.length === 0) {
        return;
    }

    const compiled = compileBuildSchemas(schemaFiles);

    ctx.emitFile({
        type: "asset",
        fileName: "gschemas.compiled",
        source: compiled,
    });

    info(`Compiled ${String(schemaFiles.length)} GSettings schema(s)`);
};

const handleSchemaHotUpdate = (state: PluginState, file: string, server: ViteDevServer): ModuleNode[] | undefined => {
    if (file.endsWith(SCHEMA_SUFFIX) || SOURCE_MODULE_RE.test(file)) {
        scheduleSchemaEnvSync(state);
    }

    const virtualId = state.trackedSchemas.get(file);

    if (!virtualId) {
        return;
    }

    const dir = ensureSchemaDir(state);
    stageSchema(dir, file);
    compileSchemaDir(state);
    info(`Recompiled GSettings schema: ${basename(file)}`);
    const mod = server.moduleGraph.getModuleById(virtualId);

    if (mod) {
        server.moduleGraph.invalidateModule(mod);

        return [mod];
    }

    return undefined;
};

const watchSchemaFiles = (state: PluginState, server: ViteDevServer): void => {
    const onClose = (): void => {
        cancelSchemaEnvSync(state);
        state.schemaDir.release();
    };

    server.httpServer?.once("close", onClose);
    server.watcher.once("close", onClose);

    const refreshSchemaTypes = (file: string): void => {
        if (file.endsWith(SCHEMA_SUFFIX) || SOURCE_MODULE_RE.test(file)) {
            scheduleSchemaEnvSync(state);
        }
    };

    server.watcher.on("add", refreshSchemaTypes);
    server.watcher.on("unlink", refreshSchemaTypes);
};

function gtkxSettings(loadConfig: ConfigLoader, buildManifest?: BuildManifestCollector): Plugin {
    const state: PluginState = {
        schemaDir: createRetainedStagingDir(SCHEMA_STAGING_PREFIX),
        rootDir: null,
        dataDir: null,
        isV2ResourceImports: false,
        isBuild: false,
        schemaEnvTimer: null,
        trackedSchemas: new Map(),
        buildSchemas: new Set(),
    };

    return {
        name: "gtkx:settings",
        enforce: "pre",

        async config(config: UserConfig) {
            await applyUserConfig(state, config, loadConfig);
        },

        configResolved(config) {
            applyResolvedConfig(state, config);
        },

        configureServer(server) {
            watchSchemaFiles(state, server);
        },

        outputOptions(options) {
            if (!state.isBuild) {
                return;
            }

            return prependBanner(options, SCHEMA_ENV_BANNER);
        },

        async resolveId(source, importer, options) {
            if (!source.endsWith(SCHEMA_SUFFIX)) {
                return;
            }

            return resolveToVirtual(this, { source, importer, options });
        },

        load(id) {
            return loadSchemaModule(this, state, id);
        },

        buildEnd() {
            emitBuildSchemas(this, state, buildManifest);
        },

        closeBundle() {
            cancelSchemaEnvSync(state);
            state.schemaDir.release();
        },

        handleHotUpdate({ file, server }) {
            return handleSchemaHotUpdate(state, file, server);
        },
    };
}

export { gtkxSettings };
