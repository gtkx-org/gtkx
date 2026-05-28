import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";
import { ASSET_PATH_RE, ASSET_RE } from "./asset-extensions.js";

const VIRTUAL_PREFIX = "\0gtkx-gresources:";
const VIRTUAL_INIT = "\0gtkx-gresources-init";
const RESOURCE_COMPILER = "glib-compile-resources";
const BUNDLE_FILENAME = "gtkx.gresource";
const DEFAULT_RESOURCE_PREFIX = "/gtkx/app";

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

/**
 * Computes the bundle-relative path for an asset, normalised to forward
 * slashes, relative to the configured source root.
 *
 * The source root is typically the directory containing the application
 * entry (e.g. `<project>/src`), so a file at `<project>/src/style.css`
 * lands at `<prefix>/style.css` — exactly where Adw and Gtk auto-load
 * resources like `style.css`, `gtk/menus.ui`, and `gtk/help-overlay.ui`
 * relative to GApplication's default `resource_base_path`.
 *
 * Throws when the file resolves outside the source root.
 */
const computeRelPath = (sourceRoot: string, absFile: string): string => {
    const rel = relative(sourceRoot, absFile).split(/[/\\]/).join("/");
    if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(
            `gtkx:gresources: asset "${absFile}" is outside the source root "${sourceRoot}". ` +
                `Move the file under the source root, or pass a wider \`sourceRoot\` to the plugin.`,
        );
    }
    return rel;
};

const escapeXml = (value: string): string =>
    value.replace(/[<>&"']/g, (char) => {
        switch (char) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case '"':
                return "&quot;";
            default:
                return "&apos;";
        }
    });

type ResourceEntry = {
    sourcePath: string;
    /** Path relative to the temp staging dir, used inside the generated XML. */
    stagedRelPath: string;
    resourcePath: string;
};

type PluginState = {
    prefix: string;
    isBuild: boolean;
    sourceRoot: string;
    server: ViteDevServer | null;
    entries: Map<string, ResourceEntry>;
    devStagingDir: string | null;
    devBundlePath: string;
};

const compileBundle = (state: PluginState, outputPath: string): Buffer => {
    const entries = state.entries.size === 0 ? new Map<string, ResourceEntry>() : state.entries;
    const staged = stageBundle(state, entries);
    try {
        return runCompiler(staged.dir, staged.manifest, outputPath);
    } finally {
        rmSync(staged.dir, { recursive: true, force: true });
    }
};

type StagedBundle = { dir: string; manifest: string };

const stageBundle = (state: PluginState, entries: Map<string, ResourceEntry>): StagedBundle => {
    const dir = mkdtempSync(join(tmpdir(), "gtkx-gresources-"));
    const fileNodes: string[] = [];
    for (const entry of entries.values()) {
        const targetPath = join(dir, entry.stagedRelPath);
        mkdirSync(dirname(targetPath), { recursive: true });
        copyFileSync(entry.sourcePath, targetPath);
        fileNodes.push(`        <file>${escapeXml(entry.stagedRelPath)}</file>`);
    }
    const prefix = escapeXml(state.prefix);
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

const registerEntry = (state: PluginState, absPath: string): ResourceEntry => {
    const existing = state.entries.get(absPath);
    if (existing) return existing;

    const relPath = computeRelPath(state.sourceRoot, absPath);
    const entry: ResourceEntry = {
        sourcePath: absPath,
        stagedRelPath: relPath,
        resourcePath: `${state.prefix}/${relPath}`,
    };
    state.entries.set(absPath, entry);
    return entry;
};

const loadAssetModule = (state: PluginState, virtualId: string): string => {
    const absPath = virtualId.slice(VIRTUAL_PREFIX.length);
    const entry = registerEntry(state, absPath);
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
 * Options accepted by {@link gtkxResources}.
 */
export type GtkxResourcesOptions = {
    /**
     * GLib application id (e.g. `"org.gtk.Demo4"`). When provided, the
     * GResource prefix is derived as `/org/gtk/Demo4`. When omitted,
     * defaults to `/gtkx/app`.
     */
    applicationId?: string;
    /**
     * Absolute path to the source root — typically the directory
     * containing the application entry (`<project>/src`). Resource paths
     * inside the bundle are computed relative to this directory, so a
     * file at `<sourceRoot>/style.css` lands at `<prefix>/style.css` and
     * is picked up by Adw/Gtk auto-loading.
     *
     * Assets resolved from outside the source root are rejected with a
     * clear error.
     *
     * When omitted, falls back to the Vite `root`. The CLI passes
     * `dirname(entry)` automatically.
     */
    sourceRoot?: string;
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
 * **Path layout:** Assets resolve to `resource:///<prefix>/<rel>` where
 * `<prefix>` comes from {@link deriveResourcePrefix} and `<rel>` is the
 * file's path relative to {@link GtkxResourcesOptions.sourceRoot}. The
 * CLI sets `sourceRoot` to `dirname(entry)`, so a file at
 * `<project>/src/style.css` lands at `<prefix>/style.css` — matching
 * GApplication's default `resource_base_path` and picked up by Adw/Gtk
 * auto-loading.
 *
 * @example
 * ```ts
 * import { gtkxResources } from "@gtkx/cli/vite-plugins/gresources";
 *
 * export default { plugins: [gtkxResources({ applicationId: "org.gtk.Demo4" })] };
 * ```
 */
export function gtkxResources(options: GtkxResourcesOptions = {}): Plugin {
    const state: PluginState = {
        prefix: deriveResourcePrefix(options.applicationId),
        isBuild: false,
        sourceRoot: "",
        server: null,
        entries: new Map(),
        devStagingDir: null,
        devBundlePath: "",
    };

    return {
        name: "gtkx:gresources",
        enforce: "pre",

        config() {
            return {
                assetsInclude: [ASSET_RE],
                define: {
                    "import.meta.env.GTKX_APP_ID": JSON.stringify(options.applicationId ?? ""),
                },
            };
        },

        configResolved(config: ResolvedConfig) {
            state.isBuild = config.command === "build";
            state.sourceRoot = options.sourceRoot ?? config.root;
        },

        configureServer(server) {
            state.server = server;
            server.watcher.on("change", (file) => {
                if (!state.entries.has(file)) return;
                refreshDevRegistration(server, state).catch((error) => {
                    console.error("[gtkx] GResource refresh failed:", error);
                });
            });
            server.watcher.on("add", (file) => {
                if (!state.entries.has(file)) return;
                refreshDevRegistration(server, state).catch((error) => {
                    console.error("[gtkx] GResource refresh failed:", error);
                });
            });
        },

        async resolveId(source, importer, opts) {
            if (source === VIRTUAL_INIT) return VIRTUAL_INIT;
            if (!ASSET_PATH_RE.test(source)) return;

            const resolved = await this.resolve(source, importer, { ...opts, skipSelf: true });
            if (!resolved || resolved.external) return;

            return VIRTUAL_PREFIX + resolved.id;
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

/**
 * Test-only: name of the virtual init module synthesized by
 * {@link gtkxResources}. Exposed so unit tests can drive the `load` hook
 * directly without depending on Vite internals.
 *
 * @internal
 */
export const __TEST_VIRTUAL_INIT = VIRTUAL_INIT;

/**
 * Test-only: prefix of the virtual asset module ids synthesized by
 * {@link gtkxResources}.
 *
 * @internal
 */
export const __TEST_VIRTUAL_PREFIX = VIRTUAL_PREFIX;

/**
 * Test-only: filename of the compiled bundle emitted by the build hook.
 *
 * @internal
 */
export const __TEST_BUNDLE_FILENAME = BUNDLE_FILENAME;

/**
 * Test-only: XML-escapes the five reserved characters (`<`, `>`, `&`, `"`,
 * `'`) used inside the generated GResource manifest.
 *
 * @internal
 */
export const __TEST_escapeXml = escapeXml;
