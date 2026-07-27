import type { ModuleNode, Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";
import { error, errorMessage, info } from "@gtkx/utils";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { prependBanner } from "../internal/banner.js";
import { resolveDataDir } from "../internal/data-dir.js";
import { removeTempDir, withStagingDir } from "../internal/staging-dir.js";
import { compileSchemas } from "../settings/compile.js";
import { parseSchemaXml, SchemaParseError } from "../settings/parser.js";
import { renderRuntimeModule } from "../settings/render.js";
import { emitSchemaEnv, prependSchemaDir, SCHEMA_SUFFIX, stageSchema } from "../settings/schema.js";
import { createVirtualNamespace } from "./virtual-module.js";

type PluginState = {
    schemaDir: string | null;
    rootDir: string | null;
    dataDir: string | null;
    isBuild: boolean;
    trackedSchemas: Map<string, string>;
    buildSchemas: Set<string>;
    cleanupProcessExit: (() => void) | null;
};

type PluginContext = {
    error: (message: string) => never;
    emitFile: (file: { type: "asset"; fileName: string; source: Buffer }) => void;
};

const VIRTUAL_PREFIX = "\0gtkx-settings:";
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
    if (!state.schemaDir) {
        const runnerDir = process.env.GTKX_DEV_SCHEMA_DIR;

        if (runnerDir) {
            state.schemaDir = runnerDir;

            return runnerDir;
        }

        const dir = mkdtempSync(join(tmpdir(), "gtkx-schemas-"));
        state.schemaDir = dir;

        const cleanup = (): void => {
            removeTempDir(dir);
        };

        state.cleanupProcessExit = cleanup;
        process.once("exit", cleanup);
    }

    return state.schemaDir;
};

const releaseSchemaDir = (state: PluginState): void => {
    if (!state.schemaDir) {
        return;
    }

    if (state.cleanupProcessExit) {
        removeTempDir(state.schemaDir);
        process.removeListener("exit", state.cleanupProcessExit);
        state.cleanupProcessExit = null;
    }

    state.schemaDir = null;
};

const compileSchemaDir = (state: PluginState): void => {
    if (!state.schemaDir) {
        return;
    }

    compileSchemas(state.schemaDir);
    process.env.GSETTINGS_SCHEMA_DIR = prependSchemaDir(state.schemaDir, process.env.GSETTINGS_SCHEMA_DIR);
};

const syncSchemaEnv = (state: PluginState): void => {
    if (state.rootDir === null) {
        return;
    }

    try {
        emitSchemaEnv(state.rootDir, state.dataDir);
    } catch (error_) {
        error(`Failed to generate GSettings schema types: ${errorMessage(error_)}`);
    }
};

const applyUserConfig = (state: PluginState, config: UserConfig): void => {
    state.dataDir = resolveDataDir(config.root ?? process.cwd());
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

const emitCompiledSchemas = (ctx: PluginContext, state: PluginState): void => {
    if (!state.isBuild || state.buildSchemas.size === 0) {
        return;
    }

    const compiled = withStagingDir("schemas-build", (dir) => {
        for (const filePath of state.buildSchemas) {
            stageSchema(dir, filePath);
        }

        compileSchemas(dir);

        return readFileSync(join(dir, "gschemas.compiled"));
    });

    ctx.emitFile({
        type: "asset",
        fileName: "gschemas.compiled",
        source: compiled,
    });

    info(`Compiled ${String(state.buildSchemas.size)} GSettings schema(s)`);
};

const handleSchemaHotUpdate = (state: PluginState, file: string, server: ViteDevServer): ModuleNode[] | undefined => {
    if (file.endsWith(SCHEMA_SUFFIX)) {
        syncSchemaEnv(state);
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
    server.httpServer?.once("close", () => {
        releaseSchemaDir(state);
    });

    server.watcher.once("close", () => {
        releaseSchemaDir(state);
    });

    const refreshSchemaTypes = (file: string): void => {
        if (file.endsWith(SCHEMA_SUFFIX)) {
            syncSchemaEnv(state);
        }
    };

    server.watcher.on("add", refreshSchemaTypes);
    server.watcher.on("unlink", refreshSchemaTypes);
};

function gtkxSettings(): Plugin {
    const state: PluginState = {
        schemaDir: null,
        rootDir: null,
        dataDir: null,
        isBuild: false,
        trackedSchemas: new Map(),
        buildSchemas: new Set(),
        cleanupProcessExit: null,
    };

    return {
        name: "gtkx:settings",
        enforce: "pre",

        config(config: UserConfig) {
            applyUserConfig(state, config);
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
            emitCompiledSchemas(this, state);
        },

        closeBundle() {
            releaseSchemaDir(state);
        },

        handleHotUpdate({ file, server }) {
            return handleSchemaHotUpdate(state, file, server);
        },
    };
}

export { gtkxSettings };
