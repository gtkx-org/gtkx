import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createGtkxConfigLoader, DATA_IMPORT_PREFIX, type GtkxConfigLoader } from "@gtkx/config";
import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";
import { removeTempDir } from "../internal/remove-temp-dir.js";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";
import { ASSET_PATH_RE, ASSET_RE } from "./asset-extensions.js";
import { BUNDLE_FILENAME, escapeXml, REL_SEPARATOR, VIRTUAL_INIT, VIRTUAL_PREFIX } from "./gresource-protocol.js";

/** The `#data/` import prefix every bundled asset is rooted at. */
const DATA_PREFIX = `${DATA_IMPORT_PREFIX}/`;

const RESOURCE_COMPILER = "glib-compile-resources";
const DEFAULT_RESOURCE_PREFIX = "/gtkx/app";
const MANIFEST_PREFIX = "/";

/**
 * Converts a GLib application id like `org.gtk.Demo4` into the standard
 * GResource path prefix `/org/gtk/Demo4`.
 *
 * Falls back to {@link DEFAULT_RESOURCE_PREFIX} when no id is supplied so
 * the pipeline still emits a deterministic, registerable path for projects
 * that have not yet declared an `applicationId` in `gtkx.config.ts`.
 */
const deriveResourcePrefix = (applicationId?: string): string => {
    if (!applicationId) return DEFAULT_RESOURCE_PREFIX;
    return `/${applicationId.replaceAll(".", "/")}`;
};

/** Strips any trailing `?query` Vite may append to an import specifier. */
const stripQuery = (source: string): string => {
    const queryIndex = source.indexOf("?");
    return queryIndex === -1 ? source : source.slice(0, queryIndex);
};

type ResourceEntry = {
    sourcePath: string;
    /** Path relative to the temp staging dir, used inside the generated XML. */
    stagedRelPath: string;
    resourcePath: string;
};

type PluginState = {
    prefix: string;
    isBuild: boolean;
    entries: Map<string, ResourceEntry>;
    /** Absolute source paths of every registered entry, for O(1) watcher-change membership tests. */
    sourcePaths: Set<string>;
    devStagingDir: string | null;
    devBundlePath: string;
};

const compileBundle = (state: PluginState, outputPath: string): Buffer => {
    const staged = stageBundle(state.entries);
    try {
        return runCompiler(staged.dir, staged.manifest, outputPath);
    } finally {
        removeTempDir(staged.dir);
    }
};

type StagedBundle = { dir: string; manifest: string };

const stageBundle = (entries: Map<string, ResourceEntry>): StagedBundle => {
    const dir = mkdtempSync(join(tmpdir(), "gtkx-gresources-"));
    const fileNodes: string[] = [];
    for (const entry of entries.values()) {
        const targetPath = join(dir, entry.stagedRelPath);
        mkdirSync(dirname(targetPath), { recursive: true });
        copyFileSync(entry.sourcePath, targetPath);
        fileNodes.push(`        <file>${escapeXml(entry.stagedRelPath)}</file>`);
    }
    const prefix = escapeXml(MANIFEST_PREFIX);
    const manifest = join(dir, "gtkx.gresource.xml");
    const xml = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<gresources>`,
        `    <gresource prefix="${prefix}">`,
        ...fileNodes,
        `    </gresource>`,
        `</gresources>`,
        ``,
    ].join("\n");
    writeFileSync(manifest, xml);
    return { dir, manifest };
};

const runCompiler = (sourceDir: string, manifest: string, outputPath: string): Buffer => {
    execFileSync(resolveCliTool(RESOURCE_COMPILER), [`--sourcedir=${sourceDir}`, `--target=${outputPath}`, manifest]);
    return readFileSync(outputPath);
};

const ensureDevBundle = (state: PluginState): void => {
    if (!state.devStagingDir) {
        state.devStagingDir = mkdtempSync(join(tmpdir(), "gtkx-gresources-dev-"));
        state.devBundlePath = join(state.devStagingDir, BUNDLE_FILENAME);
    }
    compileBundle(state, state.devBundlePath);
};

const buildInitModuleSource = (): string =>
    [
        `import { dirname, join } from "node:path";`,
        `import { fileURLToPath } from "node:url";`,
        `import { resourceLoad, resourcesRegister } from "@gtkx/gi/gio";`,
        ``,
        `const bundleDir = dirname(fileURLToPath(import.meta.url));`,
        `const resource = resourceLoad(join(bundleDir, ${JSON.stringify(BUNDLE_FILENAME)}));`,
        `resourcesRegister(resource);`,
        ``,
        `export function ensureRegistered() {}`,
        `export function __refresh() {}`,
    ].join("\n");

const devInitModuleSource = (bundlePath: string): string => {
    const bundlePathLiteral = JSON.stringify(bundlePath);
    return [
        `import { statSync } from "node:fs";`,
        `import { resourceLoad, resourcesRegister, resourcesUnregister } from "@gtkx/gi/gio";`,
        ``,
        `let current = null;`,
        `let lastSig = "";`,
        ``,
        `function register() {`,
        `    const next = resourceLoad(${bundlePathLiteral});`,
        `    if (current) resourcesUnregister(current);`,
        `    resourcesRegister(next);`,
        `    current = next;`,
        `}`,
        ``,
        `export function ensureRegistered() {`,
        `    const { size, mtimeMs } = statSync(${bundlePathLiteral});`,
        `    const sig = size + ":" + mtimeMs;`,
        `    if (sig === lastSig) return;`,
        `    register();`,
        `    lastSig = sig;`,
        `}`,
        ``,
        `ensureRegistered();`,
        ``,
        `export function __refresh() {`,
        `    register();`,
        `    const { size, mtimeMs } = statSync(${bundlePathLiteral});`,
        `    lastSig = size + ":" + mtimeMs;`,
        `}`,
    ].join("\n");
};

const renderInitModule = (state: PluginState): string =>
    state.isBuild ? buildInitModuleSource() : devInitModuleSource(state.devBundlePath);

const registerEntry = (state: PluginState, absPath: string, rel: string): ResourceEntry => {
    const existing = state.entries.get(absPath);
    if (existing) return existing;

    const resourcePath = `${state.prefix}/${rel}`;
    const entry: ResourceEntry = {
        sourcePath: absPath,
        stagedRelPath: resourcePath.replace(/^\/+/, ""),
        resourcePath,
    };
    state.entries.set(absPath, entry);
    state.sourcePaths.add(absPath);
    return entry;
};

const isTrackedSource = (state: PluginState, file: string): boolean => state.sourcePaths.has(file);

const loadAssetModule = (state: PluginState, virtualId: string): string => {
    const rest = virtualId.slice(VIRTUAL_PREFIX.length);
    const separatorIndex = rest.indexOf(REL_SEPARATOR);
    const absPath = rest.slice(0, separatorIndex);
    const rel = rest.slice(separatorIndex + REL_SEPARATOR.length);
    const entry = registerEntry(state, absPath, rel);
    const uri = `resource://${entry.resourcePath}`;

    if (!state.isBuild) {
        ensureDevBundle(state);
    }

    return [
        `import { ensureRegistered } from ${JSON.stringify(VIRTUAL_INIT)};`,
        `ensureRegistered();`,
        `export default ${JSON.stringify(uri)};`,
        `export const path = ${JSON.stringify(entry.resourcePath)};`,
    ].join("\n");
};

const emitBuildBundle = (
    ctx: { emitFile: (asset: { type: "asset"; fileName: string; source: Buffer }) => string },
    state: PluginState,
): void => {
    if (!state.isBuild || state.entries.size === 0) return;
    const outDir = mkdtempSync(join(tmpdir(), "gtkx-gresources-out-"));
    try {
        const compiled = compileBundle(state, join(outDir, BUNDLE_FILENAME));
        ctx.emitFile({ type: "asset", fileName: BUNDLE_FILENAME, source: compiled });
        console.log(`[gtkx] Compiled ${state.entries.size} resource(s) into ${BUNDLE_FILENAME}`);
    } finally {
        removeTempDir(outDir);
    }
};

const refreshDevRegistration = async (server: ViteDevServer, state: PluginState): Promise<void> => {
    ensureDevBundle(state);
    try {
        // biome-ignore lint/style/useNamingConvention: Fast Refresh module hook injected by the React plugin
        const mod = (await server.ssrLoadModule(VIRTUAL_INIT)) as { __refresh?: () => void };
        mod.__refresh?.();
    } catch (error) {
        console.error("[gtkx] Failed to refresh GResource bundle:", error);
    }
};

/**
 * Reads `applicationId` from the resolved `gtkx.config.ts`, fixes the plugin's
 * resource prefix from it, and returns the partial Vite config: the asset
 * matcher.
 */
const resolveResourceConfig = async (state: PluginState, config: UserConfig, loadConfig: GtkxConfigLoader) => {
    const { applicationId } = await loadConfig(config.root ?? process.cwd());
    state.prefix = deriveResourcePrefix(applicationId);
    return {
        assetsInclude: [ASSET_RE],
    };
};

/**
 * Wires the dev server's watcher so a change to any tracked asset recompiles
 * and re-registers the GResource bundle without a process restart.
 */
const attachResourceWatcher = (state: PluginState, server: ViteDevServer): void => {
    const onFileEvent = (file: string): void => {
        if (!isTrackedSource(state, file)) return;
        refreshDevRegistration(server, state).catch((error) => {
            console.error("[gtkx] GResource refresh failed:", error);
        });
    };
    server.watcher.on("change", onFileEvent);
    server.watcher.on("add", onFileEvent);
};

/**
 * Vite plugin that bundles static asset imports into a single
 * `.gresource` file and rewrites import sites to `resource:///` URIs.
 *
 * **Build mode:** Every `#data/` asset import is captured during `load`; the
 * collected files are compiled with `glib-compile-resources` at `buildEnd`
 * into `dist/gtkx.gresource`. A generated init module registers the bundle
 * with GIO when the user's entry first imports any asset.
 *
 * **Dev mode:** The bundle is staged into a temp directory and recompiled
 * whenever an asset file changes; the init module exposes a `__refresh`
 * hook that re-registers the bundle without restarting the process.
 *
 * **Path layout:** Assets are imported through the `#data/` root (the
 * `package.json` subpath import `"#data/*": "./data/*"`), and resolve to
 * `resource:///<prefix>/<rest>`, where `<prefix>` is derived from the
 * `applicationId` declared in `gtkx.config.ts` (loaded during the `config`
 * hook) — `org.gtk.Demo4` yields `/org/gtk/Demo4`, a missing id falls back to
 * `/gtkx/app` — and `<rest>` is the path after `#data/`. So
 * `import "#data/icons/logo.svg"` lands at `<prefix>/icons/logo.svg`, and
 * `import "#data/style.css"` at `<prefix>/style.css`, the GApplication default
 * `resource_base_path` Adw/Gtk auto-load from. The exact value is otherwise
 * incidental — callers use the import's returned `path`/URI rather than
 * depending on it.
 *
 * @param loadConfig - Memoizing config loader, shared with the other gtkx
 *   plugins by `gtkxVitePlugins` so the pipeline loads `gtkx.config.ts` once.
 */
export function gtkxResources(loadConfig: GtkxConfigLoader = createGtkxConfigLoader()): Plugin {
    const state: PluginState = {
        prefix: DEFAULT_RESOURCE_PREFIX,
        isBuild: false,
        entries: new Map(),
        sourcePaths: new Set(),
        devStagingDir: null,
        devBundlePath: "",
    };

    return {
        name: "gtkx:gresources",
        enforce: "pre",

        config(config: UserConfig) {
            return resolveResourceConfig(state, config, loadConfig);
        },

        configResolved(config: ResolvedConfig) {
            state.isBuild = config.command === "build";
        },

        configureServer(server) {
            attachResourceWatcher(state, server);
        },

        async resolveId(source, importer, opts) {
            if (source === VIRTUAL_INIT) return VIRTUAL_INIT;
            const clean = stripQuery(source);
            if (!clean.startsWith(DATA_PREFIX) || !ASSET_PATH_RE.test(clean)) return;

            const resolved = await this.resolve(clean, importer, { ...opts, skipSelf: true });
            if (!resolved || resolved.external) return;

            const rel = clean.slice(DATA_PREFIX.length);
            return VIRTUAL_PREFIX + resolved.id + REL_SEPARATOR + rel;
        },

        load(id) {
            if (id === VIRTUAL_INIT) return renderInitModule(state);
            if (!id.startsWith(VIRTUAL_PREFIX)) return;
            return loadAssetModule(state, id);
        },

        buildEnd() {
            emitBuildBundle(this, state);
        },
    };
}
