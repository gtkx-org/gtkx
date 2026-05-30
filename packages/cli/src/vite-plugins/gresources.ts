import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";
import { loadApplicationId } from "../codegen/config-loader.js";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";
import { ASSET_PATH_RE, ASSET_RE } from "./asset-extensions.js";
import { BUNDLE_FILENAME, escapeXml, OVERRIDE_SEPARATOR, VIRTUAL_INIT, VIRTUAL_PREFIX } from "./gresource-protocol.js";

const RESOURCE_COMPILER = "glib-compile-resources";
const DEFAULT_RESOURCE_PREFIX = "/gtkx/app";
const RESOURCE_QUERY = "resource";
const MANIFEST_PREFIX = "/";

/**
 * Converts a GLib application id like `org.gtk.Demo4` into the standard
 * GResource path prefix `/org/gtk/Demo4`.
 *
 * Falls back to {@link DEFAULT_RESOURCE_PREFIX} when no id is supplied so
 * the pipeline still emits a deterministic, registerable path for projects
 * that have not yet declared an `applicationId` in `gtkx.config.ts`.
 */
export const deriveResourcePrefix = (applicationId?: string): string => {
    if (!applicationId) return DEFAULT_RESOURCE_PREFIX;
    return `/${applicationId.replaceAll(".", "/")}`;
};

const toForwardSlashes = (value: string): string => value.split(/[/\\]/).join("/");

/**
 * Splits an import specifier into its path and an optional `?resource=`
 * override. Returns `override: null` when the query is absent; an empty
 * `?resource=` yields an empty-string override (a deliberate request for
 * the bundle root).
 */
const parseResourceQuery = (source: string): { path: string; override: string | null } => {
    const queryIndex = source.indexOf("?");
    if (queryIndex === -1) return { path: source, override: null };
    const params = new URLSearchParams(source.slice(queryIndex + 1));
    return { path: source.slice(0, queryIndex), override: params.get(RESOURCE_QUERY) };
};

/**
 * Computes an asset's GResource path.
 *
 * With no `?resource=` override, the path is the file's location relative
 * to the Vite `root`, nested under `prefix` — the caller does not care
 * about the exact value and simply uses the import's returned `path`.
 * Throws when the file resolves outside the Vite root.
 *
 * With a `?resource=<path>` override, the path is taken verbatim: a
 * relative override nests under `prefix` (e.g. `?resource=style.css` →
 * `<prefix>/style.css`, matching GApplication's default
 * `resource_base_path` so Adw/Gtk auto-load it), while an override with a
 * leading slash is absolute and bypasses `prefix` entirely (e.g.
 * `?resource=/css_multiplebgs/brick.png`).
 */
const computeResourcePath = (state: PluginState, absFile: string, override: string | null): string => {
    if (override !== null) {
        const normalized = toForwardSlashes(override);
        if (normalized.startsWith("/")) {
            return `/${normalized.replace(/^\/+/, "")}`;
        }
        return `${state.prefix}/${normalized}`;
    }
    const rel = toForwardSlashes(relative(state.root, absFile));
    if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(
            `gtkx:gresources: asset "${absFile}" is outside the Vite root "${state.root}". ` +
                `Move the file under the root, or pin its location with an explicit \`?resource=<path>\` import query.`,
        );
    }
    return `${state.prefix}/${rel}`;
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
    root: string;
    server: ViteDevServer | null;
    entries: Map<string, ResourceEntry>;
    devStagingDir: string | null;
    devBundlePath: string;
};

const compileBundle = (state: PluginState, outputPath: string): Buffer => {
    const entries = state.entries.size === 0 ? new Map<string, ResourceEntry>() : state.entries;
    const staged = stageBundle(entries);
    try {
        return runCompiler(staged.dir, staged.manifest, outputPath);
    } finally {
        rmSync(staged.dir, { recursive: true, force: true });
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
        `import { resourceLoad, resourcesRegister } from "@gtkx/ffi/gio";`,
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
        `import { resourceLoad, resourcesRegister, resourcesUnregister } from "@gtkx/ffi/gio";`,
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

const registerEntry = (state: PluginState, absPath: string, override: string | null): ResourceEntry => {
    const key = `${absPath}\0${override ?? ""}`;
    const existing = state.entries.get(key);
    if (existing) return existing;

    const resourcePath = computeResourcePath(state, absPath, override);
    const entry: ResourceEntry = {
        sourcePath: absPath,
        stagedRelPath: resourcePath.replace(/^\/+/, ""),
        resourcePath,
    };
    state.entries.set(key, entry);
    return entry;
};

const isTrackedSource = (state: PluginState, file: string): boolean => {
    for (const entry of state.entries.values()) {
        if (entry.sourcePath === file) return true;
    }
    return false;
};

const decodeVirtualAsset = (virtualId: string): { absPath: string; override: string | null } => {
    const rest = virtualId.slice(VIRTUAL_PREFIX.length);
    const sepIndex = rest.indexOf(OVERRIDE_SEPARATOR);
    if (sepIndex === -1) return { absPath: rest, override: null };
    return {
        absPath: rest.slice(0, sepIndex),
        override: rest.slice(sepIndex + OVERRIDE_SEPARATOR.length),
    };
};

const loadAssetModule = (state: PluginState, virtualId: string): string => {
    const { absPath, override } = decodeVirtualAsset(virtualId);
    const entry = registerEntry(state, absPath, override);
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
        rmSync(outDir, { recursive: true, force: true });
    }
};

const refreshDevRegistration = async (server: ViteDevServer, state: PluginState): Promise<void> => {
    ensureDevBundle(state);
    try {
        const mod = (await server.ssrLoadModule(VIRTUAL_INIT)) as { __refresh?: () => void };
        mod.__refresh?.();
    } catch (error) {
        console.error("[gtkx] Failed to refresh GResource bundle:", error);
    }
};

/**
 * Loads `applicationId` from `gtkx.config.ts`, fixes the plugin's resource
 * prefix from it, and returns the partial Vite config: the asset matcher and
 * the single `import.meta.env.GTKX_APP_ID` define.
 */
const resolveResourceConfig = async (state: PluginState, config: UserConfig) => {
    const applicationId = await loadApplicationId(config.root ?? process.cwd());
    state.prefix = deriveResourcePrefix(applicationId);
    return {
        assetsInclude: [ASSET_RE],
        define: {
            "import.meta.env.GTKX_APP_ID": JSON.stringify(applicationId ?? ""),
        },
    };
};

/**
 * Wires the dev server's watcher so a change to any tracked asset recompiles
 * and re-registers the GResource bundle without a process restart.
 */
const attachResourceWatcher = (state: PluginState, server: ViteDevServer): void => {
    state.server = server;
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
 * **Build mode:** Every bare asset import is captured during `load`; the
 * collected files are compiled with `glib-compile-resources` at `buildEnd`
 * into `dist/gtkx.gresource`. A generated init module registers the bundle
 * with GIO when the user's entry first imports any asset.
 *
 * **Dev mode:** The bundle is staged into a temp directory and recompiled
 * whenever an asset file changes; the init module exposes a `__refresh`
 * hook that re-registers the bundle without restarting the process.
 *
 * **Path layout:** By default an asset resolves to
 * `resource:///<prefix>/<path-relative-to-vite-root>`, where `<prefix>` is
 * derived by {@link deriveResourcePrefix} from the `applicationId` declared
 * in `gtkx.config.ts` (loaded during the `config` hook). The exact value is
 * incidental — callers use the import's returned `path`/URI rather than
 * depending on it.
 *
 * **Explicit paths:** Append `?resource=<path>` to pin where an asset
 * lands. A relative override nests under `<prefix>` (e.g.
 * `import css from "./style.css?resource=style.css"` →
 * `resource:///<prefix>/style.css`, matching GApplication's default
 * `resource_base_path` so Adw/Gtk auto-load it). A leading slash makes the
 * override absolute and bypasses `<prefix>` (e.g.
 * `?resource=/css_multiplebgs/brick.png` →
 * `resource:///css_multiplebgs/brick.png`).
 */
export function gtkxResources(): Plugin {
    const state: PluginState = {
        prefix: DEFAULT_RESOURCE_PREFIX,
        isBuild: false,
        root: "",
        server: null,
        entries: new Map(),
        devStagingDir: null,
        devBundlePath: "",
    };

    return {
        name: "gtkx:gresources",
        enforce: "pre",

        config(config: UserConfig) {
            return resolveResourceConfig(state, config);
        },

        configResolved(config: ResolvedConfig) {
            state.isBuild = config.command === "build";
            state.root = config.root;
        },

        configureServer(server) {
            attachResourceWatcher(state, server);
        },

        async resolveId(source, importer, opts) {
            if (source === VIRTUAL_INIT) return VIRTUAL_INIT;
            if (!ASSET_PATH_RE.test(source)) return;

            const { path: rawSource, override } = parseResourceQuery(source);
            const resolved = await this.resolve(rawSource, importer, { ...opts, skipSelf: true });
            if (!resolved || resolved.external) return;

            const suffix = override === null ? "" : `${OVERRIDE_SEPARATOR}${override}`;
            return VIRTUAL_PREFIX + resolved.id + suffix;
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
