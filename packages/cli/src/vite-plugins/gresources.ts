import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { type ConfigLoader, createConfigLoader } from "@gtkx/config/internal";
import { error, formatChildProcessError, info } from "@gtkx/utils";
import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";
import { DATA_IMPORT_PREFIX, resolveDataDir } from "../internal/data-dir.js";
import { resolveCliTool } from "../internal/resolve-cli-tool.js";
import { withStagingDir } from "../internal/staging-dir.js";
import { ASSET_PATH_RE, ASSET_RE } from "./asset-extensions.js";
import { renderInitModule } from "./gresource-init-module.js";
import {
    BUNDLE_FILENAME,
    escapeXml,
    fromVirtualId,
    isVirtual,
    REL_SEPARATOR,
    toVirtualId,
    VIRTUAL_INIT,
} from "./gresource-shared.js";

const DATA_PREFIX = `${DATA_IMPORT_PREFIX}/`;

const RESOURCE_COMPILER = "glib-compile-resources";
const MANIFEST_PREFIX = "/";

const deriveResourcePrefix = (applicationId: string): string => `/${applicationId.replaceAll(".", "/")}`;

const stripQuery = (source: string): string => {
    const queryIndex = source.indexOf("?");
    return queryIndex === -1 ? source : source.slice(0, queryIndex);
};

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

const compileBundle = (state: PluginState, outputPath: string): Buffer =>
    withStagingDir("gresources", (dir) => {
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
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<gresources>`,
        `    <gresource prefix="${prefix}">`,
        ...fileNodes,
        `    </gresource>`,
        `</gresources>`,
        ``,
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
        throw new Error(`${RESOURCE_COMPILER} failed${details ? `:\n${details}` : ""}`, { cause: error });
    }
    return readFileSync(outputPath);
};

const ensureStagingDir = (state: PluginState): void => {
    if (!state.devStagingDir) {
        state.devStagingDir = mkdtempSync(join(tmpdir(), "gtkx-gresources-dev-"));
        state.devBundlePath = join(state.devStagingDir, BUNDLE_FILENAME);
    }
};

const entriesSignature = (state: PluginState): string =>
    [...state.entries.keys()].sort((a, b) => a.localeCompare(b)).join("\0");

const compileDevBundle = (state: PluginState): void => {
    ensureStagingDir(state);
    if (state.entries.size === 0) return;
    compileBundle(state, state.devBundlePath);
    state.compiledSignature = entriesSignature(state);
};

const reregisterDevBundle = async (state: PluginState): Promise<void> => {
    const server = state.server;
    if (!server) return;
    const mod = (await server.ssrLoadModule(VIRTUAL_INIT)) as { __refresh?: () => void };
    mod.__refresh?.();
};

const scanDataAssets = (dataDir: string): { absPath: string; rel: string }[] => {
    if (!existsSync(dataDir)) return [];
    return readdirSync(dataDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && ASSET_RE.test(entry.name))
        .map((entry) => {
            const absPath = join(entry.parentPath, entry.name);
            return { absPath, rel: relative(dataDir, absPath) };
        });
};

const primeDevBundle = (state: PluginState): void => {
    if (state.dataDir === null) return;
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
    const compiled = withStagingDir("gresources-out", (outDir) => compileBundle(state, join(outDir, BUNDLE_FILENAME)));
    ctx.emitFile({ type: "asset", fileName: BUNDLE_FILENAME, source: compiled });
    info(`Compiled ${state.entries.size} resource(s) into ${BUNDLE_FILENAME}`);
};

const refreshDevRegistration = async (state: PluginState): Promise<void> => {
    compileDevBundle(state);
    try {
        await reregisterDevBundle(state);
    } catch (cause) {
        error("Failed to refresh GResource bundle:", cause);
    }
};

const resolveResourceConfig = async (state: PluginState, config: UserConfig, loadConfig: ConfigLoader) => {
    const { applicationId } = await loadConfig(config.root ?? process.cwd());
    state.prefix = deriveResourcePrefix(applicationId);
    return {
        assetsInclude: [ASSET_RE],
    };
};

const attachResourceWatcher = (state: PluginState, server: ViteDevServer): void => {
    state.server = server;
    const onFileEvent = (file: string): void => {
        if (!isTrackedSource(state, file)) return;
        refreshDevRegistration(state).catch((cause) => {
            error("GResource refresh failed:", cause);
        });
    };
    server.watcher.on("change", onFileEvent);
    server.watcher.on("add", onFileEvent);
};

export function gtkxGResources(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
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
        name: "gtkx:gresources",
        enforce: "pre",

        config(config: UserConfig) {
            return resolveResourceConfig(state, config, loadConfig);
        },

        configResolved(config: ResolvedConfig) {
            state.isBuild = config.command === "build";
            if (!state.isBuild) {
                const relativeDataDir = resolveDataDir(config.root);
                state.dataDir = relativeDataDir === null ? null : join(config.root, relativeDataDir);
            }
        },

        configureServer(server) {
            attachResourceWatcher(state, server);
            primeDevBundle(state);
        },

        async resolveId(source, importer, opts) {
            if (source === VIRTUAL_INIT) return VIRTUAL_INIT;
            const clean = stripQuery(source);
            if (!clean.startsWith(DATA_PREFIX) || !ASSET_PATH_RE.test(clean)) return;

            const resolved = await this.resolve(clean, importer, { ...opts, skipSelf: true });
            if (!resolved || resolved.external) return;

            const rel = clean.slice(DATA_PREFIX.length);
            return toVirtualId(resolved.id) + REL_SEPARATOR + rel;
        },

        load(id) {
            if (id === VIRTUAL_INIT) {
                if (!state.isBuild) ensureStagingDir(state);
                return renderInitModule({ isBuild: state.isBuild, devBundlePath: state.devBundlePath });
            }
            if (!isVirtual(id)) return;
            return loadAssetModule(state, id);
        },

        buildEnd() {
            emitBuildBundle(this, state);
        },
    };
}
