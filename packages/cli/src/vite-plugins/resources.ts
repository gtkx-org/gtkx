import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import { error, info, isRecord, sortStrings } from "@gtkx/utils";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, sep } from "node:path";
import type { AssetEmitter } from "./asset-emitter.js";
import { resolveDataDir } from "../internal/data-dir.js";
import { type ListedFile, listFilesRecursive } from "../internal/list-files.js";
import { loadModuleExclusively } from "../internal/module-loads.js";
import { runCliTool } from "../internal/run-cli-tool.js";
import { discoverSourceImports } from "../internal/source-imports.js";
import { createRetainedStagingDir, type RetainedStagingDir, withStagingDir } from "../internal/staging-dir.js";
import { ASSET_RE } from "./asset-extensions.js";
import {
    DATA_PREFIX,
    isBareRelativeAsset,
    isDataAsset,
    parseResourceSpecifier,
} from "./asset-specifier.js";
import { renderInitModule } from "./resource-init-module.js";
import {
    BUNDLE_FILENAME,
    escapeXml,
    fromVirtualId,
    isVirtual,
    REFRESH_EXPORT,
    REL_SEPARATOR,
    RESOURCE_PATH_EXPORT,
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
    root: string;
    isBuild: boolean;
    isV2: boolean;
    entries: Map<string, ResourceEntry>;
    sourcePaths: Set<string>;
    stagingDir: RetainedStagingDir;
    devBundlePath: string;
    server: ViteDevServer | null;
    compiledSignature: string;
    dataDir: string | null;
};

type ResolveContext = {
    resolve: (
        source: string,
        importer?: string,
        options?: Record<string, unknown>,
    ) => Promise<{ id: string; external?: boolean | string } | null>;
};

type PackageOwner = {
    dir: string;
    name: string;
};

type AssetResolveRequest = {
    assetSource: string;
    importer: string | undefined;
    resourcePath: string | null;
    options: Record<string, unknown> | undefined;
};

type LegacyResolveRequest = {
    source: string;
    importer: string | undefined;
    options: Record<string, unknown> | undefined;
};

const RESOURCE_COMPILER = "glib-compile-resources";
const MANIFEST_PREFIX = "/";
const DEV_STAGING_PREFIX = "resources-dev";
const MANIFEST_FILENAME = "package.json";
const RESOURCE_QUERY_MENTION_RE = /[?&]resource(?:[=&]|$)/;

const deriveResourcePrefix = (applicationId: string): string => `/${applicationId.replaceAll(".", "/")}`;
const toForwardSlashes = (value: string): string => value.replaceAll(/[/\\]/g, "/");

const isWithin = (root: string, path: string): boolean => {
    const rel = relative(root, path);

    return rel.length > 0 && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
};

const isDependencyFile = (root: string, path: string): boolean =>
    isWithin(root, path) && relative(root, path).split(sep).includes("node_modules");

const packageIdentityIn = (dir: string): string | null => {
    try {
        const manifest: unknown = JSON.parse(readFileSync(join(dir, MANIFEST_FILENAME), "utf8"));

        return isRecord(manifest) && typeof manifest.name === "string" ? manifest.name : null;
    } catch {
        return null;
    }
};

const packageIn = (dir: string): PackageOwner | null => {
    const name = packageIdentityIn(dir);

    if (name !== null) {
        return { dir, name };
    }

    const parent = dirname(dir);

    return parent === dir ? null : packageIn(parent);
};

const packageForFile = (file: string): PackageOwner | null => packageIn(dirname(file));

const validateResourcePath = (resourcePath: string): string => {
    if (
        resourcePath === "/" ||
        !resourcePath.startsWith("/") ||
        resourcePath.endsWith("/") ||
        resourcePath.includes("\0") ||
        posix.normalize(resourcePath) !== resourcePath
    ) {
        throw new Error(
            `${JSON.stringify(resourcePath)} is not a valid GResource path; use an absolute normalized path`,
        );
    }

    return resourcePath;
};

const derivedResourcePath = (state: PluginState, sourcePath: string): string => {
    if (isWithin(state.root, sourcePath) && !isDependencyFile(state.root, sourcePath)) {
        return validateResourcePath(`${state.prefix}/${toForwardSlashes(relative(state.root, sourcePath))}`);
    }

    const owner = packageForFile(sourcePath);

    if (owner === null || !isWithin(owner.dir, sourcePath)) {
        throw new Error(`${sourcePath} is outside the application and does not belong to a named package`);
    }

    const packagePath = toForwardSlashes(relative(owner.dir, sourcePath));

    return validateResourcePath(`${state.prefix}/${owner.name}/${packagePath}`);
};

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
    runCliTool({
        tool: RESOURCE_COMPILER,
        args: [`--sourcedir=${sourceDir}`, `--target=${outputPath}`, manifest],
    });

    return readFileSync(outputPath);
};

const ensureStagingDir = (state: PluginState): void => {
    state.devBundlePath = join(state.stagingDir.retain(), BUNDLE_FILENAME);
};

const releaseStagingDir = (state: PluginState): void => {
    state.stagingDir.release();
    state.devBundlePath = "";
    state.compiledSignature = "";
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

    const mod = await loadModuleExclusively(server, VIRTUAL_INIT);
    const refresh: unknown = mod[REFRESH_EXPORT];

    if (isRefreshHook(refresh)) {
        refresh();
    }
};

const scanDataAssets = (dataDir: string): ListedFile[] => listFilesRecursive(dataDir, (name) => ASSET_RE.test(name));

const primeLegacyDevBundle = (state: PluginState): void => {
    if (state.dataDir === null) {
        return;
    }

    for (const { absPath, rel } of scanDataAssets(state.dataDir)) {
        registerEntry(state, absPath, rel);
    }

    compileDevBundle(state);
};

const sourceImportRoot = (root: string): string => {
    const sourceDir = join(root, "src");

    return existsSync(sourceDir) ? sourceDir : root;
};

const primeV2DevBundle = async (ctx: ResolveContext, state: PluginState): Promise<void> => {
    if (state.isBuild || !state.isV2) {
        return;
    }

    const imports = discoverSourceImports(sourceImportRoot(state.root));

    for (const entry of imports) {
        const specifier = parseResourceSpecifier(entry.source);

        if (specifier === null) {
            continue;
        }

        await resolveAssetEntry(
            ctx,
            state,
            {
                assetSource: specifier.assetSource,
                importer: entry.importer,
                resourcePath: specifier.resourcePath,
                options: undefined,
            },
        );
    }

    registerDevAsset(state);
};

const registerDevAsset = (state: PluginState): void => {
    if (entriesSignature(state) !== state.compiledSignature) {
        compileDevBundle(state);
    }
};

const registerEntry = (state: PluginState, absPath: string, rel: string): ResourceEntry => {
    const resourcePath = validateResourcePath(rel.startsWith("/") ? rel : `${state.prefix}/${rel}`);
    const existing = state.entries.get(resourcePath);

    if (existing) {
        if (existing.sourcePath !== absPath) {
            throw new Error(
                `${existing.sourcePath} and ${absPath} both resolve to the GResource path ${resourcePath}`,
            );
        }

        return existing;
    }

    const entry: ResourceEntry = {
        sourcePath: absPath,
        stagedRelPath: resourcePath.replace(/^\/+/, ""),
        resourcePath,
    };

    state.entries.set(resourcePath, entry);
    state.sourcePaths.add(absPath);

    return entry;
};

const isTrackedSource = (state: PluginState, file: string): boolean => state.sourcePaths.has(file);

const virtualAssetId = (entry: ResourceEntry): string =>
    toVirtualId(entry.sourcePath) + REL_SEPARATOR + entry.resourcePath;

const resolveAssetEntry = async (
    ctx: ResolveContext,
    state: PluginState,
    request: AssetResolveRequest,
): Promise<ResourceEntry | undefined> => {
    const resolved = await ctx.resolve(request.assetSource, request.importer, {
        ...request.options,
        skipSelf: true,
    });

    if (!resolved || resolved.external) {
        return undefined;
    }

    const sourcePath = stripQuery(resolved.id);

    if (!isAbsolute(sourcePath)) {
        throw new Error(`${JSON.stringify(request.assetSource)} did not resolve to a file-backed asset`);
    }

    return registerEntry(
        state,
        sourcePath,
        request.resourcePath === null
            ? derivedResourcePath(state, sourcePath)
            : validateResourcePath(request.resourcePath),
    );
};

const resolveLegacyAssetEntry = async (
    ctx: ResolveContext,
    state: PluginState,
    request: LegacyResolveRequest,
): Promise<ResourceEntry | undefined> => {
    const resolved = await ctx.resolve(request.source, request.importer, { ...request.options, skipSelf: true });

    if (!resolved || resolved.external) {
        return undefined;
    }

    const sourcePath = stripQuery(resolved.id);

    if (!isAbsolute(sourcePath)) {
        return undefined;
    }

    return registerEntry(state, sourcePath, request.source.slice(DATA_PREFIX.length));
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
    const defaultValue = state.isV2 ? entry.resourcePath : uri;

    if (!state.isBuild) {
        registerDevAsset(state);
    }

    return [
        `import { ensureRegistered } from ${JSON.stringify(VIRTUAL_INIT)};`,
        "ensureRegistered();",
        `export default ${JSON.stringify(defaultValue)};`,
        `export const ${RESOURCE_PATH_EXPORT} = ${JSON.stringify(entry.resourcePath)};`,
    ].join("\n");
};

const emitBuildBundle = (ctx: AssetEmitter, state: PluginState): void => {
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
    const loaded = await loadConfig.load(config.root ?? process.cwd());
    state.prefix = deriveResourcePrefix(loaded.config.applicationId);
    state.root = loaded.root;
    state.isV2 = loaded.config.future?.v2ResourceImports === true;

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

    const onClose = (): void => {
        releaseStagingDir(state);
    };

    server.httpServer?.once("close", onClose);
    server.watcher.once("close", onClose);
    server.watcher.on("change", onFileEvent);
    server.watcher.on("add", onFileEvent);
};

const applyResolvedConfig = (state: PluginState, config: ResolvedConfig): void => {
    state.isBuild = config.command === "build";
    state.root = config.root;
    state.dataDir = null;

    if (state.isBuild || state.isV2) {
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

const isLegacyDataSpecifier = (source: string): boolean =>
    source.startsWith(DATA_PREFIX) && ASSET_RE.test(stripQuery(source));

const rejectInvalidV2Specifier = (source: string): void => {
    if (RESOURCE_QUERY_MENTION_RE.test(source)) {
        throw new Error(
            `${JSON.stringify(source)} is not a valid resource import; use ?resource or ` +
            "?resource=/absolute/path",
        );
    }

    if (isBareRelativeAsset(source)) {
        throw new Error(`${JSON.stringify(source)} must choose ?resource for a GResource or ?url for an emitted file`);
    }
};

const resolveV2ResourceId = async (
    ctx: ResolveContext,
    state: PluginState,
    request: LegacyResolveRequest,
): Promise<string | undefined> => {
    if (isLegacyDataSpecifier(request.source)) {
        throw new Error(
            `${JSON.stringify(request.source)} uses the legacy #data asset form; import it relatively with ` +
            "?resource or ?url",
        );
    }

    const specifier = parseResourceSpecifier(request.source);

    if (specifier !== null) {
        const entry = await resolveAssetEntry(ctx, state, {
            assetSource: specifier.assetSource,
            importer: request.importer,
            resourcePath: specifier.resourcePath,
            options: request.options,
        });

        return entry === undefined ? undefined : virtualAssetId(entry);
    }

    rejectInvalidV2Specifier(request.source);

    return undefined;
};

const resolveLegacyResourceId = async (
    ctx: ResolveContext,
    state: PluginState,
    request: LegacyResolveRequest,
): Promise<string | undefined> => {
    if (RESOURCE_QUERY_MENTION_RE.test(request.source)) {
        throw new Error(`${JSON.stringify(request.source)} requires future.v2ResourceImports`);
    }

    if (!isDataAsset(request.source)) {
        return undefined;
    }

    const entry = await resolveLegacyAssetEntry(ctx, state, request);

    return entry === undefined ? undefined : virtualAssetId(entry);
};

const resolveResourceId = (
    ctx: ResolveContext,
    state: PluginState,
    request: LegacyResolveRequest,
): Promise<string | undefined> => {
    if (request.source === VIRTUAL_INIT) {
        return Promise.resolve(VIRTUAL_INIT);
    }

    return state.isV2
        ? resolveV2ResourceId(ctx, state, request)
        : resolveLegacyResourceId(ctx, state, request);
};

const configureResourceServer = (state: PluginState, server: ViteDevServer): void => {
    attachResourceWatcher(state, server);
    primeLegacyDevBundle(state);
};

const createResourcesPlugin = (state: PluginState, loadConfig: ConfigLoader): Plugin => ({
    name: "gtkx:resources",
    enforce: "pre",
    perEnvironmentStartEndDuringDev: true,

    config: (config: UserConfig) => resolveResourceConfig(state, config, loadConfig),

    configResolved: (config: ResolvedConfig) => {
        applyResolvedConfig(state, config);
    },

    configureServer: (server) => {
        configureResourceServer(state, server);
    },

    async buildStart() {
        await primeV2DevBundle(this, state);
    },

    resolveId(source, importer, options) {
        return resolveResourceId(this, state, { source, importer, options });
    },

    load(id) {
        return loadResourceModule(state, id);
    },

    buildEnd() {
        emitBuildBundle(this, state);
    },

    closeBundle() {
        releaseStagingDir(state);
    },
});

function gtkxResources(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: PluginState = {
        prefix: "",
        root: "",
        isBuild: false,
        isV2: false,
        entries: new Map(),
        sourcePaths: new Set(),
        stagingDir: createRetainedStagingDir(DEV_STAGING_PREFIX),
        devBundlePath: "",
        server: null,
        compiledSignature: "",
        dataDir: null,
    };

    return createResourcesPlugin(state, loadConfig);
}

export { gtkxResources };
