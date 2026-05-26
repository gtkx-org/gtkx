import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ModuleNode, Plugin, ViteDevServer } from "vite";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";

const SCHEMA_SUFFIX = ".gschema.xml";
const SCHEMA_ID_RE = /<schema\s+id="([^"]+)"/g;
const VIRTUAL_PREFIX = "\0gtkx-gsettings:";
const VIRTUAL_INIT = "\0gtkx-gsettings-init";
const SCHEMA_COMPILER = "glib-compile-schemas";

/**
 * Vite plugin that compiles GSettings schemas when imported.
 *
 * Intercepts imports of `.gschema.xml` files. The import's default export
 * is the schema ID extracted from the XML, so downstream code can use it
 * directly with `useSetting`. When the file contains multiple `<schema>`
 * elements, each ID is also available as a named export (with dots
 * replaced by underscores).
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
 * import schemaId from "./com.example.myapp.gschema.xml";
 * const [value, setValue] = useSetting(schemaId, "my-key", "string");
 * ```
 */
type PluginState = {
    schemaDir: string | null;
    isBuild: boolean;
    trackedSchemas: Map<string, string>;
    buildSchemas: Map<string, string>;
};

type PluginContext = {
    error: (msg: string) => never;
    emitFile: (file: { type: "asset"; fileName: string; source: Buffer }) => void;
};

const ensureSchemaDir = (state: PluginState): string => {
    if (!state.schemaDir) {
        state.schemaDir = mkdtempSync(join(tmpdir(), "gtkx-schemas-"));
    }
    return state.schemaDir;
};

const compileSchemaDir = (state: PluginState): void => {
    if (!state.schemaDir) return;
    execFileSync(resolveCliTool(SCHEMA_COMPILER), [state.schemaDir]);
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

const extractSchemaIds = (xml: string): string[] => {
    const ids: string[] = [];
    for (const match of xml.matchAll(SCHEMA_ID_RE)) {
        if (match[1]) ids.push(match[1]);
    }
    return ids;
};

const renderSchemaExports = (schemaIds: string[], isBuild: boolean): string => {
    const exports = [`export default ${JSON.stringify(schemaIds[0])};`];
    for (const schemaId of schemaIds) {
        const exportName = schemaId.replaceAll(".", "_");
        exports.push(`export const ${exportName} = ${JSON.stringify(schemaId)};`);
    }
    if (isBuild) {
        return [`import ${JSON.stringify(VIRTUAL_INIT)};`, "", ...exports].join("\n");
    }
    return exports.join("\n");
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

    const schemaIds = extractSchemaIds(xml);
    if (schemaIds.length === 0) {
        ctx.error(`No <schema id="..."> found in ${fileName}`);
    }
    return renderSchemaExports(schemaIds, state.isBuild);
};

const emitCompiledSchemas = (ctx: PluginContext, state: PluginState): void => {
    if (!state.isBuild || state.buildSchemas.size === 0) return;

    const dir = mkdtempSync(join(tmpdir(), "gtkx-schemas-build-"));
    for (const [filePath, fileName] of state.buildSchemas) {
        copyFileSync(filePath, join(dir, fileName));
    }
    execFileSync(resolveCliTool(SCHEMA_COMPILER), [dir]);

    const compiled = readFileSync(join(dir, "gschemas.compiled"));
    ctx.emitFile({
        type: "asset",
        fileName: "gschemas.compiled",
        source: compiled,
    });

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
        isBuild: false,
        trackedSchemas: new Map(),
        buildSchemas: new Map(),
    };

    return {
        name: "gtkx:gsettings",
        enforce: "pre",

        configResolved(config) {
            state.isBuild = config.command === "build";
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

        handleHotUpdate({ file, server }) {
            return handleSchemaHotUpdate(state, file, server);
        },
    };
}
