import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";
import { type ConfigLoader, createConfigLoader } from "@gtkx/config/internal";
import { error, formatChildProcessError, info, sortStrings } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DATA_IMPORT_PREFIX, resolveDataDir } from "../internal/data-dir.js";
import { type ListedFile, listFilesRecursive } from "../internal/list-files.js";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";
import { withStagingDir } from "../internal/staging-dir.js";
import { ASSET_PATH_RE, ASSET_RE } from "./asset-extensions.js";
import { renderInitModule } from "./resource-init-module.js";
import {
    BUNDLE_FILENAME,
    escapeXml,
    fromVirtualId,
    isVirtual,
    REFRESH_EXPORT,
    REL_SEPARATOR,
    toVirtualId,
    VIRTUAL_INIT,
} from "./resource-shared.js";
import { stripQuery } from "./strip-query.js";

type ResourceEntry = {
    sourcePath: string;
    stagedRelPath: string;
    resourcePath: string;
};

type PluginState = {
    prefix: string;
    isBuild: boolean;
    entries: Map<string, ResourceEntry>;
    sourcePaths: Set<string>;
    devStagingDir: string | null;
    devBundlePath: string;
    server: ViteDevServer | null;
    compiledSignature: string;
    dataDir: string | null;
};

const DATA_PREFIX = `${DATA_IMPORT_PREFIX}/`;
const RESOURCE_COMPILER = "glib-compile-resources";
const MANIFEST_PREFIX = "/";

const deriveResourcePrefix = (applicationId: string): string => `/${applicationId.replaceAll(".", "/")}`;

const compileBundle = (state: PluginState, outputPath: string): Buffer =>
    withStagingDir("resources", (dir) => {
        const manifest = stageBundle(dir, state.entries);

        return runCompiler(dir, manifest, outputPath);
    });

const stageBundle = (dir: string, entries: Map<string, ResourceEntry>): string => {
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
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<gresources>",
        `    <gresource prefix="${prefix}">`,
        ...fileNodes,
        "    </gresource>",
        "</gresources>",
        "",
    ].join("\n");

    writeFileSync(manifest, xml);

    return manifest;
};

const runCompiler = (sourceDir: string, manifest: string, outputPath: string): Buffer => {
    try {
        execFileSync(resolveCliTool(RESOURCE_COMPILER), [
            `--sourcedir=${sourceDir}`,
            `--target=${outputPath}`,
            manifest,
        ]);
    } catch (error) {
        const details = formatChildProcessError(error);
        const suffix = details ? `:\n${details}` : "";
        throw new Error(`${RESOURCE_COMPILER} failed${suffix}`, { cause: error });
    }

    return readFileSync(outputPath);
};

const ensureStagingDir = (state: PluginState): void => {
    if (state.devStagingDir) {
        return;
    }

    state.devStagingDir = mkdtempSync(join(tmpdir(), "gtkx-resources-dev-"));
    state.devBundlePath = join(state.devStagingDir, BUNDLE_FILENAME);
};

const entriesSignature = (state: PluginState): string => sortStrings(state.entries.keys()).join("\0");

const compileDevBundle = (state: PluginState): void => {
    ensureStagingDir(state);

    if (state.entries.size === 0) {
        return;
    }

    compileBundle(state, state.devBundlePath);
    state.compiledSignature = entriesSignature(state);
};

const isRefreshHook = (value: unknown): value is () => void => typeof value === "function";

const reregisterDevBundle = async (state: PluginState): Promise<void> => {
    const server = state.server;

    if (!server) {
        return;
    }

    const mod = await server.ssrLoadModule(VIRTUAL_INIT);
    const refresh: unknown = mod[REFRESH_EXPORT];

    if (isRefreshHook(refresh)) {
        refresh();
    }
};

const scanDataAssets = (dataDir: string): ListedFile[] => listFilesRecursive(dataDir, (name) => ASSET_RE.test(name));

const primeDevBundle = (state: PluginState): void => {
    if (state.dataDir === null) {
        return;
    }

    for (const { absPath, rel } of scanDataAssets(state.dataDir)) {
        registerEntry(state, absPath, rel);
    }

    compileDevBundle(state);
};

const registerDevAsset = (state: PluginState): void => {
    if (entriesSignature(state) !== state.compiledSignature) {
        compileDevBundle(state);
    }
};

const registerEntry = (state: PluginState, absPath: string, rel: string): ResourceEntry => {
    const existing = state.entries.get(absPath);

    if (existing) {
        return existing;
    }

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

const dataAssetSource = (source: string): string | null => {
    const clean = stripQuery(source);

    if (!clean.startsWith(DATA_PREFIX) || !ASSET_PATH_RE.test(clean)) {
        return null;
    }

    return clean;
};

const resolvedAssetId = (
    resolved: { id: string; external: boolean | string } | null,
    clean: string,
): string | undefined => {
    if (!resolved || resolved.external) {
        return undefined;
    }

    return toVirtualId(resolved.id) + REL_SEPARATOR + clean.slice(DATA_PREFIX.length);
};

const loadInitModule = (state: PluginState): string => {
    if (!state.isBuild) {
        ensureStagingDir(state);
    }

    return renderInitModule({ isBuild: state.isBuild, devBundlePath: state.devBundlePath });
};

const loadAssetModule = (state: PluginState, virtualId: string): string => {
    const rest = fromVirtualId(virtualId);
    const separatorIndex = rest.indexOf(REL_SEPARATOR);
    const absPath = rest.slice(0, separatorIndex);
    const rel = rest.slice(separatorIndex + REL_SEPARATOR.length);
    const entry = registerEntry(state, absPath, rel);
    const uri = `resource://${entry.resourcePath}`;

    if (!state.isBuild) {
        registerDevAsset(state);
    }

    return [
        `import { ensureRegistered } from ${JSON.stringify(VIRTUAL_INIT)};`,
        "ensureRegistered();",
        `export default ${JSON.stringify(uri)};`,
        `export const path = ${JSON.stringify(entry.resourcePath)};`,
    ].join("\n");
};

const emitBuildBundle = (
    ctx: { emitFile: (asset: { type: "asset"; fileName: string; source: Buffer }) => string },
    state: PluginState,
): void => {
    if (!state.isBuild || state.entries.size === 0) {
        return;
    }

    const compiled = withStagingDir("resources-out", (outDir) => compileBundle(state, join(outDir, BUNDLE_FILENAME)));
    ctx.emitFile({ type: "asset", fileName: BUNDLE_FILENAME, source: compiled });
    info(`Compiled ${String(state.entries.size)} resource(s) into ${BUNDLE_FILENAME}`);
};

const refreshDevRegistration = async (state: PluginState): Promise<void> => {
    compileDevBundle(state);

    try {
        await reregisterDevBundle(state);
    } catch (error_) {
        error("Failed to refresh GResource bundle:", error_);
    }
};

const resolveResourceConfig = async (state: PluginState, config: UserConfig, loadConfig: ConfigLoader) => {
    const { applicationId } = await loadConfig.resolve(config.root ?? process.cwd());
    state.prefix = deriveResourcePrefix(applicationId);

    return {
        assetsInclude: [ASSET_RE],
    };
};

const refreshTrackedSource = async (state: PluginState, file: string): Promise<void> => {
    if (!isTrackedSource(state, file)) {
        return;
    }

    try {
        await refreshDevRegistration(state);
    } catch (error_) {
        error("GResource refresh failed:", error_);
    }
};

const attachResourceWatcher = (state: PluginState, server: ViteDevServer): void => {
    state.server = server;

    const onFileEvent = (file: string): void => {
        void refreshTrackedSource(state, file);
    };

    server.watcher.on("change", onFileEvent);
    server.watcher.on("add", onFileEvent);
};

const applyResolvedConfig = (state: PluginState, config: ResolvedConfig): void => {
    state.isBuild = config.command === "build";

    if (state.isBuild) {
        return;
    }

    const relativeDataDir = resolveDataDir(config.root);
    state.dataDir = relativeDataDir === null ? null : join(config.root, relativeDataDir);
};

const loadResourceModule = (state: PluginState, id: string): string | undefined => {
    if (id === VIRTUAL_INIT) {
        return loadInitModule(state);
    }

    if (!isVirtual(id)) {
        return undefined;
    }

    return loadAssetModule(state, id);
};

function gtkxResources(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: PluginState = {
        prefix: "",
        isBuild: false,
        entries: new Map(),
        sourcePaths: new Set(),
        devStagingDir: null,
        devBundlePath: "",
        server: null,
        compiledSignature: "",
        dataDir: null,
    };

    return {
        name: "gtkx:resources",
        enforce: "pre",

        config(config: UserConfig) {
            return resolveResourceConfig(state, config, loadConfig);
        },

        configResolved(config: ResolvedConfig) {
            applyResolvedConfig(state, config);
        },

        configureServer(server) {
            attachResourceWatcher(state, server);
            primeDevBundle(state);
        },

        async resolveId(source, importer, opts) {
            if (source === VIRTUAL_INIT) {
                return VIRTUAL_INIT;
            }

            const clean = dataAssetSource(source);

            if (clean === null) {
                return;
            }

            const resolved = await this.resolve(clean, importer, { ...opts, skipSelf: true });

            return resolvedAssetId(resolved, clean);
        },

        load(id) {
            return loadResourceModule(state, id);
        },

        buildEnd() {
            emitBuildBundle(this, state);
        },
    };
}

export { gtkxResources };
