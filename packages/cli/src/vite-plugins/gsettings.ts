import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { errorMessage } from "@gtkx/utils";
import type { ModuleNode, Plugin, ViteDevServer } from "vite";
import { emitSchemaEnv } from "../gsettings/env.js";
import { parseSchemaXml, SchemaParseError } from "../gsettings/parser.js";
import { renderRuntimeModule } from "../gsettings/render.js";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";

const SCHEMA_SUFFIX = ".gschema.xml";
const VIRTUAL_PREFIX = "\0gtkx-gsettings:";
const VIRTUAL_INIT = "\0gtkx-gsettings-init";
const SCHEMA_COMPILER = "glib-compile-schemas";
const SCHEMA_COMPILE_TIMEOUT_MS = 30_000;

const removeTempDir = (dir: string): void => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
};

const compileSchemas = (dir: string): void => {
    try {
        execFileSync(resolveCliTool(SCHEMA_COMPILER), [dir], {
            stdio: ["ignore", "pipe", "pipe"],
            timeout: SCHEMA_COMPILE_TIMEOUT_MS,
            encoding: "utf-8",
        });
    } catch (error) {
        const stderr = (error as { stderr?: string }).stderr ?? "";
        const stdout = (error as { stdout?: string }).stdout ?? "";
        const details = [stderr, stdout].filter(Boolean).join("\n").trim();
        throw new Error(`glib-compile-schemas failed for ${dir}${details ? `:\n${details}` : ""}`, { cause: error });
    }
};

/**
 * Vite plugin that compiles GSettings schemas when imported.
 *
 * Intercepts imports of `.gschema.xml` files. Each schema in the file
 * becomes a named export (its ID with dots replaced by underscores) holding
 * a typed schema reference usable with `useSetting`; the first schema is
 * also the default export. The matching ambient module types are generated
 * into the project's `node_modules/.gtkx/env.d.ts`, which is kept fresh on
 * dev-server start and whenever a `.gschema.xml` file is added, changed, or
 * removed.
 *
 * **Dev mode:** Copies the schema to a temporary directory, runs
 * `glib-compile-schemas`, and sets `GSETTINGS_SCHEMA_DIR` so
 * `Gio.Settings` can find the compiled result. Schema file changes
 * trigger recompilation via HMR.
 *
 * **Build mode:** All imported schemas are compiled together at build time
 * into a single `gschemas.compiled` asset emitted next to the bundle. At
 * runtime a shared init module sets `GSETTINGS_SCHEMA_DIR` to the
 * bundle's directory once, regardless of how many schemas are imported.
 *
 * @example
 * ```ts
 * import schema from "./com.example.myapp.gschema.xml";
 * const [value, setValue] = useSetting(schema, "my-key");
 * ```
 */
type PluginState = {
    schemaDir: string | null;
    rootDir: string | null;
    isBuild: boolean;
    trackedSchemas: Map<string, string>;
    buildSchemas: Map<string, string>;
    cleanupProcessExit: (() => void) | null;
};

type PluginContext = {
    error: (message: string) => never;
    emitFile: (file: { type: "asset"; fileName: string; source: Buffer }) => void;
};

const ensureSchemaDir = (state: PluginState): string => {
    if (!state.schemaDir) {
        const dir = mkdtempSync(join(tmpdir(), "gtkx-schemas-"));
        state.schemaDir = dir;
        const cleanup = (): void => removeTempDir(dir);
        state.cleanupProcessExit = cleanup;
        process.once("exit", cleanup);
    }
    return state.schemaDir;
};

const releaseSchemaDir = (state: PluginState): void => {
    if (!state.schemaDir) return;
    removeTempDir(state.schemaDir);
    if (state.cleanupProcessExit) {
        process.removeListener("exit", state.cleanupProcessExit);
        state.cleanupProcessExit = null;
    }
    state.schemaDir = null;
};

const compileSchemaDir = (state: PluginState): void => {
    if (!state.schemaDir) return;
    compileSchemas(state.schemaDir);
    const existing = process.env.GSETTINGS_SCHEMA_DIR;
    process.env.GSETTINGS_SCHEMA_DIR = existing ? `${state.schemaDir}:${existing}` : state.schemaDir;
};

const renderInitModule = (): string =>
    [
        `import { dirname } from "node:path";`,
        `import { fileURLToPath } from "node:url";`,
        ``,
        `const bundleDir = dirname(fileURLToPath(import.meta.url));`,
        `const existing = process.env.GSETTINGS_SCHEMA_DIR;`,
        `process.env.GSETTINGS_SCHEMA_DIR = existing ? bundleDir + ":" + existing : bundleDir;`,
    ].join("\n");

const syncSchemaEnv = (state: PluginState): void => {
    if (state.rootDir === null) return;
    try {
        emitSchemaEnv(state.rootDir);
    } catch (error) {
        console.error(`[gtkx] Failed to generate GSettings schema types: ${errorMessage(error)}`);
    }
};

const registerSchemaForMode = (state: PluginState, filePath: string, fileName: string, id: string): void => {
    if (state.isBuild) {
        state.buildSchemas.set(filePath, fileName);
        console.log(`[gtkx] Queued GSettings schema: ${fileName}`);
        return;
    }
    state.trackedSchemas.set(filePath, id);
    const dir = ensureSchemaDir(state);
    copyFileSync(filePath, join(dir, fileName));
    compileSchemaDir(state);
    console.log(`[gtkx] Compiled GSettings schema: ${fileName}`);
};

const loadSchemaModule = (ctx: PluginContext, state: PluginState, id: string): string => {
    const filePath = id.slice(VIRTUAL_PREFIX.length);
    const xml = readFileSync(filePath, "utf-8");
    const fileName = basename(filePath);

    registerSchemaForMode(state, filePath, fileName, id);

    let parsed: ReturnType<typeof parseSchemaXml>;
    try {
        parsed = parseSchemaXml(xml, fileName);
    } catch (error) {
        if (!(error instanceof SchemaParseError)) throw error;
        ctx.error(error.message);
    }
    if (parsed.schemas.length === 0) {
        ctx.error(`No <schema id="..."> found in ${fileName}`);
    }
    return renderRuntimeModule(parsed, state.isBuild ? VIRTUAL_INIT : null);
};

const emitCompiledSchemas = (ctx: PluginContext, state: PluginState): void => {
    if (!state.isBuild || state.buildSchemas.size === 0) return;

    const dir = mkdtempSync(join(tmpdir(), "gtkx-schemas-build-"));
    try {
        for (const [filePath, fileName] of state.buildSchemas) {
            copyFileSync(filePath, join(dir, fileName));
        }
        compileSchemas(dir);

        const compiled = readFileSync(join(dir, "gschemas.compiled"));
        ctx.emitFile({
            type: "asset",
            fileName: "gschemas.compiled",
            source: compiled,
        });
    } finally {
        removeTempDir(dir);
    }

    console.log(`[gtkx] Compiled ${state.buildSchemas.size} GSettings schema(s)`);
};

const handleSchemaHotUpdate = (state: PluginState, file: string, server: ViteDevServer): ModuleNode[] | undefined => {
    const virtualId = state.trackedSchemas.get(file);
    if (!virtualId) return;

    const dir = ensureSchemaDir(state);
    copyFileSync(file, join(dir, basename(file)));
    compileSchemaDir(state);

    console.log(`[gtkx] Recompiled GSettings schema: ${basename(file)}`);

    const mod = server.moduleGraph.getModuleById(virtualId);
    if (mod) {
        server.moduleGraph.invalidateModule(mod);
        return [mod];
    }
    return undefined;
};

export function gtkxGSettings(): Plugin {
    const state: PluginState = {
        schemaDir: null,
        rootDir: null,
        isBuild: false,
        trackedSchemas: new Map(),
        buildSchemas: new Map(),
        cleanupProcessExit: null,
    };

    return {
        name: "gtkx:gsettings",
        enforce: "pre",

        configResolved(config) {
            state.isBuild = config.command === "build";
            state.rootDir = typeof config.root === "string" ? config.root : null;
            syncSchemaEnv(state);
        },

        configureServer(server) {
            server.httpServer?.once("close", () => releaseSchemaDir(state));
            server.watcher.once("close", () => releaseSchemaDir(state));
            const refreshSchemaTypes = (file: string): void => {
                if (file.endsWith(SCHEMA_SUFFIX)) syncSchemaEnv(state);
            };
            server.watcher.on("add", refreshSchemaTypes);
            server.watcher.on("unlink", refreshSchemaTypes);
        },

        async resolveId(source, importer, options) {
            if (source === VIRTUAL_INIT) return VIRTUAL_INIT;
            if (!source.endsWith(SCHEMA_SUFFIX)) return;

            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            });
            if (!resolved || resolved.external) return;

            return VIRTUAL_PREFIX + resolved.id;
        },

        load(id) {
            if (id === VIRTUAL_INIT) return renderInitModule();
            if (!id.startsWith(VIRTUAL_PREFIX)) return;
            return loadSchemaModule(this, state, id);
        },

        buildEnd() {
            emitCompiledSchemas(this, state);
        },

        closeBundle() {
            releaseSchemaDir(state);
        },

        handleHotUpdate({ file, server }) {
            if (file.endsWith(SCHEMA_SUFFIX)) syncSchemaEnv(state);
            return handleSchemaHotUpdate(state, file, server);
        },
    };
}
