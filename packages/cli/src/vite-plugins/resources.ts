import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, ResolvedConfig, Rolldown, UserConfig, ViteDevServer } from "vite";
import { createConfigLoader, resourceBasePath, viteProjectRoot } from "@gtkx/config/internal";
import { info, isPathInside, isRecord, sortStrings, toPosixPath } from "@gtkx/utils";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, posix, relative, sep } from "node:path";
import { parseSync } from "vite";
import { runCliTool } from "../internal/run-cli-tool.js";
import { sourceLanguage } from "../internal/source-imports.js";
import { createRetainedStagingDir, type RetainedStagingDir, withStagingDir } from "../internal/staging-dir.js";
import { ASSET_RE } from "./asset-extensions.js";
import { isBareRelativeAsset, parseIconSpecifier, parseResourceSpecifier } from "./asset-specifier.js";
import { renderInitModule } from "./resource-init-module.js";
import {
    ASSET_MODULE_SUFFIX,
    BUNDLE_FILENAME,
    escapeXml,
    fromVirtualId,
    ICON_NAME_SEPARATOR,
    isVirtual,
    REL_SEPARATOR,
    RESOURCE_PATH_EXPORT,
    RESOURCE_RESOLVE_OPTION,
    toVirtualId,
    VIRTUAL_ID_RE,
    VIRTUAL_INIT,
    VIRTUAL_INIT_RE,
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
    entries: Map<string, ResourceEntry>;
    stagingDir: RetainedStagingDir;
    devBundlePath: string;
    server: ViteDevServer | null;
    compiledSignature: string;
    bundleReferenceId: string | null;
    iconOwners: Map<string, ResourceEntry>;
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

type IconResolveRequest = {
    assetSource: string;
    iconName: string | null;
    importer: string | undefined;
    options: Record<string, unknown> | undefined;
};

type ResolvedIconEntry = {
    entry: ResourceEntry;
    iconName: string;
};

type RetainedIconModuleId = {
    id: string;
    moduleSideEffects: true;
};

type ResourceModuleId = string | RetainedIconModuleId;

type DerivedIconEntry = {
    iconIdentity: string;
    iconName: string;
    resourcePath: string;
};

type ResolveRequest = {
    source: string;
    importer: string | undefined;
    options: Record<string, unknown> | undefined;
};

const RESOURCE_COMPILER = "glib-compile-resources";
const MANIFEST_PREFIX = "/";
const DEV_STAGING_PREFIX = "resources-dev";
const MANIFEST_FILENAME = "package.json";
const DATA_PREFIX = "#data/";
const BUNDLED_QUERY_MENTION_RE = /[?&](?:icon|resource)(?:[=&]|$)/;
const ICON_EXTENSIONS: Set<string> = new Set([".png", ".svg", ".xpm"]);

const ICON_CONTEXTS: Set<string> = new Set([
    "actions",
    "animations",
    "apps",
    "categories",
    "devices",
    "emblems",
    "emotes",
    "filesystems",
    "intl",
    "mimetypes",
    "places",
    "status",
]);

const STOCK_ICON_CONTEXTS: Set<string> = new Set([
    "chart",
    "code",
    "data",
    "form",
    "image",
    "io",
    "media",
    "navigation",
    "net",
    "object",
    "table",
    "text",
]);

const ICON_SIZE_RE = /^([1-9]\d*)x\1(?:@[1-9]\d*)?$/;
const RESERVED_ICON_NAMES: Set<string> = new Set(["", ".", ".."]);

const isDependencyFile = (root: string, path: string): boolean =>
    isPathInside(root, path) && relative(root, path).split(sep).includes("node_modules");

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
    if (isPathInside(state.root, sourcePath) && !isDependencyFile(state.root, sourcePath)) {
        return validateResourcePath(`${state.prefix}/${toPosixPath(relative(state.root, sourcePath))}`);
    }

    const owner = packageForFile(sourcePath);

    if (owner === null || !isPathInside(owner.dir, sourcePath)) {
        throw new Error(`${sourcePath} is outside the application and does not belong to a named package`);
    }

    const packagePath = toPosixPath(relative(owner.dir, sourcePath));

    return validateResourcePath(`${state.prefix}/${owner.name}/${packagePath}`);
};

const iconExtension = (sourcePath: string): string => {
    const extension = extname(sourcePath).toLowerCase();

    if (!ICON_EXTENSIONS.has(extension)) {
        throw new Error(`${sourcePath} is not a supported themed icon; use an SVG, PNG, or XPM file`);
    }

    return extension;
};

const hasIconNamePathSeparator = (value: string): boolean =>
    value.includes("\0") || value.includes("/") || value.includes("\\");

const validateIconName = (value: string): string => {
    if (
        RESERVED_ICON_NAMES.has(value) ||
        hasIconNamePathSeparator(value) ||
        ICON_EXTENSIONS.has(extname(value).toLowerCase())
    ) {
        throw new Error(
            `${JSON.stringify(value)} is not a valid icon name; use an extensionless filename without slashes`,
        );
    }

    return value;
};

const isIconContext = (parts: string[]): boolean => {
    const [first, second] = parts;

    if (parts.length === 1) {
        return first !== undefined && ICON_CONTEXTS.has(first);
    }

    return parts.length === 2 && first === "stock" && second !== undefined && STOCK_ICON_CONTEXTS.has(second);
};

const isIconLayout = (parts: string[]): boolean => {
    const [size, ...context] = parts;

    if (size === "symbolic") {
        return context.length === 1 && context[0] === "apps";
    }

    return size !== undefined && (size === "scalable" || ICON_SIZE_RE.test(size)) && isIconContext(context);
};

const iconLayoutInParts = (parts: string[], beforeIndex: number): string | null => {
    const index = parts.lastIndexOf("icons", beforeIndex);

    if (index === -1) {
        return null;
    }

    const treePath = parts.slice(index + 1, -1);
    const layout = treePath[0] === "hicolor" ? treePath.slice(1) : treePath;

    return isIconLayout(layout) ? layout.join("/") : iconLayoutInParts(parts, index - 1);
};

const iconLayoutFromTree = (sourcePath: string): string | null => {
    const parts = toPosixPath(sourcePath).split("/");

    return iconLayoutInParts(parts, parts.length - 2);
};

const derivedIconEntry = (state: PluginState, sourcePath: string, requestedName: string | null): DerivedIconEntry => {
    const extension = iconExtension(sourcePath);
    const sourceName = basename(sourcePath, extname(sourcePath));
    const iconName = validateIconName(requestedName ?? sourceName);
    const layout = iconLayoutFromTree(sourcePath);

    const iconIdentity =
        layout === null ? `${state.prefix}/icons/${iconName}` : `${state.prefix}/icons/${layout}/${iconName}`;

    const resourcePath = validateResourcePath(`${iconIdentity}${extension}`);

    return { iconIdentity, iconName, resourcePath };
};

const hasSideEffectIconImport = (code: string, id: string): boolean => {
    const lang = sourceLanguage(stripQuery(id));

    if (lang === undefined || !code.includes("?icon")) {
        return false;
    }

    const parsed = parseSync(id, code, { lang });

    if (parsed.errors.length > 0) {
        return false;
    }

    return parsed.module.staticImports.some(
        (statement) => statement.entries.length === 0 && parseIconSpecifier(statement.moduleRequest.value) !== null,
    );
};

const retainSideEffectIconImport = (code: string, id: string): { code: string; moduleSideEffects: true } | null =>
    hasSideEffectIconImport(code, id) ? { code, moduleSideEffects: true } : null;

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
        '<?xml version="1.0" encoding="UTF-8"?>',
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

const entriesSignature = (state: PluginState): string =>
    sortStrings([...state.entries].map(([resourcePath, entry]) => `${resourcePath}\0${entry.sourcePath}`)).join("\0");

const compileDevBundle = (state: PluginState): void => {
    ensureStagingDir(state);

    if (state.entries.size === 0) {
        rmSync(state.devBundlePath, { force: true });
        state.compiledSignature = "";

        return;
    }

    compileBundle(state, state.devBundlePath);
    state.compiledSignature = entriesSignature(state);
};

const registerDevAsset = (state: PluginState): void => {
    if (entriesSignature(state) !== state.compiledSignature) {
        compileDevBundle(state);
    }
};

const createResourceEntry = (sourcePath: string, resourcePath: string): ResourceEntry => ({
    sourcePath,
    stagedRelPath: resourcePath.replace(/^\/+/, ""),
    resourcePath,
});

const activateEntry = (state: PluginState, entry: ResourceEntry): ResourceEntry => {
    const existing = state.entries.get(entry.resourcePath);

    if (existing !== undefined) {
        if (existing.sourcePath !== entry.sourcePath) {
            throw new Error(
                `${existing.sourcePath} and ${entry.sourcePath} both resolve to the GResource path ` +
                    entry.resourcePath,
            );
        }

        return existing;
    }

    state.entries.set(entry.resourcePath, entry);
    state.server?.watcher.add(dirname(entry.sourcePath));

    return entry;
};

const assertIconIdentityAvailable = (state: PluginState, iconIdentity: string, sourcePath: string): void => {
    const existing = state.iconOwners.get(iconIdentity);

    if (existing !== undefined && existing.sourcePath !== sourcePath) {
        throw new Error(`${existing.sourcePath} and ${sourcePath} both claim the themed icon ${iconIdentity}`);
    }
};

const registerEntry = (state: PluginState, absPath: string, rel: string): ResourceEntry => {
    const resourcePath = validateResourcePath(rel.startsWith("/") ? rel : `${state.prefix}/${rel}`);

    return activateEntry(state, createResourceEntry(absPath, resourcePath));
};

const registerIconEntry = (state: PluginState, sourcePath: string, derived: DerivedIconEntry): ResourceEntry => {
    assertIconIdentityAvailable(state, derived.iconIdentity, sourcePath);
    const entry = registerEntry(state, sourcePath, derived.resourcePath);
    state.iconOwners.set(derived.iconIdentity, entry);

    return entry;
};

const virtualEntryId = (entry: ResourceEntry): string =>
    toVirtualId(entry.sourcePath) + REL_SEPARATOR + entry.resourcePath;

const virtualAssetId = (entry: ResourceEntry): string => virtualEntryId(entry) + ASSET_MODULE_SUFFIX;

const virtualIconId = ({ entry, iconName }: ResolvedIconEntry): string =>
    virtualEntryId(entry) + ICON_NAME_SEPARATOR + iconName + ASSET_MODULE_SUFFIX;

const resolveCustomOptions = (options: Record<string, unknown> | undefined): Record<string, unknown> => {
    const custom = options?.["custom"];

    return isRecord(custom) ? custom : {};
};

const resolveAssetSource = async (
    ctx: ResolveContext,
    request: { assetSource: string; importer: string | undefined; options: Record<string, unknown> | undefined },
): Promise<string> => {
    const resolved = await ctx.resolve(request.assetSource, request.importer, {
        ...request.options,
        custom: { ...resolveCustomOptions(request.options), [RESOURCE_RESOLVE_OPTION]: true },
        skipSelf: true,
    });

    if (!resolved || resolved.external) {
        throw Object.assign(
            new Error(`${JSON.stringify(request.assetSource)} could not be resolved to a bundled asset`),
            {
                code: "GTKX_UNRESOLVED_IMPORT",
                specifier: request.assetSource,
            },
        );
    }

    const sourcePath = stripQuery(resolved.id);

    if (!isAbsolute(sourcePath)) {
        throw new Error(`${JSON.stringify(request.assetSource)} did not resolve to a file-backed asset`);
    }

    return sourcePath;
};

const resolveAssetEntry = async (
    ctx: ResolveContext,
    state: PluginState,
    request: AssetResolveRequest,
): Promise<ResourceEntry> => {
    const sourcePath = await resolveAssetSource(ctx, request);

    return registerEntry(
        state,
        sourcePath,
        request.resourcePath === null
            ? derivedResourcePath(state, sourcePath)
            : validateResourcePath(request.resourcePath),
    );
};

const resolveIconEntry = async (
    ctx: ResolveContext,
    state: PluginState,
    request: IconResolveRequest,
): Promise<ResolvedIconEntry> => {
    const sourcePath = await resolveAssetSource(ctx, request);

    const derived = derivedIconEntry(state, sourcePath, request.iconName);

    return {
        entry: registerIconEntry(state, sourcePath, derived),
        iconName: derived.iconName,
    };
};

const loadInitModule = (state: PluginState): string => {
    if (state.isBuild) {
        if (state.bundleReferenceId === null) {
            throw new Error("Cannot render the GResource loader before its bundle has been emitted");
        }

        return renderInitModule({ isBuild: true, bundleReferenceId: state.bundleReferenceId });
    }

    ensureStagingDir(state);

    return renderInitModule({ isBuild: false, devBundlePath: state.devBundlePath });
};

const virtualAssetMetadata = (virtualId: string): { absPath: string; iconName: string | null; rel: string } => {
    const rest = fromVirtualId(virtualId).slice(0, -ASSET_MODULE_SUFFIX.length);
    const separatorIndex = rest.indexOf(REL_SEPARATOR);
    const relAndMetadata = rest.slice(separatorIndex + REL_SEPARATOR.length);
    const iconSeparatorIndex = relAndMetadata.indexOf(ICON_NAME_SEPARATOR);

    return {
        absPath: rest.slice(0, separatorIndex),
        iconName:
            iconSeparatorIndex === -1 ? null : relAndMetadata.slice(iconSeparatorIndex + ICON_NAME_SEPARATOR.length),
        rel: iconSeparatorIndex === -1 ? relAndMetadata : relAndMetadata.slice(0, iconSeparatorIndex),
    };
};

const resourcePathExport = (entry: ResourceEntry, iconName: string | null): string[] =>
    iconName === null ? [`export const ${RESOURCE_PATH_EXPORT} = ${JSON.stringify(entry.resourcePath)};`] : [];

const assetModuleImports = (iconName: string | null): string[] => [
    `import { ensureRegistered } from ${JSON.stringify(VIRTUAL_INIT)};`,
    ...(iconName === null
        ? []
        : ['import { Display } from "@gtkx/gi/gdk";', 'import { IconTheme } from "@gtkx/gi/gtk";']),
];

const iconThemeRegistration = (state: PluginState, iconName: string | null): string[] => {
    if (iconName === null) {
        return [];
    }

    const resourceIconPath = `${state.prefix}/icons`;

    return [
        `const resourceIconPath = ${JSON.stringify(resourceIconPath)};`,
        "function refreshIconTheme() {",
        "    const display = Display.getDefault();",
        "    if (!display) return;",
        "    const theme = IconTheme.getForDisplay(display);",
        "    const paths = theme.getResourcePath() ?? [];",
        "    theme.setResourcePath(paths.includes(resourceIconPath) ? [...paths] : [...paths, resourceIconPath]);",
        "}",
        "refreshIconTheme();",
    ];
};

const loadAssetModule = (state: PluginState, virtualId: string): string => {
    const { absPath, iconName, rel } = virtualAssetMetadata(virtualId);
    const resourcePath = validateResourcePath(rel);
    const entry = registerEntry(state, absPath, resourcePath);
    const defaultValue = iconName ?? entry.resourcePath;
    if (!state.isBuild) {
        registerDevAsset(state);
    }

    return [
        ...assetModuleImports(iconName),
        "ensureRegistered();",
        ...iconThemeRegistration(state, iconName),
        `export default ${JSON.stringify(defaultValue)};`,
        ...resourcePathExport(entry, iconName),
    ].join("\n");
};

const finalizeBuildBundle = (
    ctx: Pick<Rolldown.PluginContext, "getFileName">,
    bundle: Rolldown.OutputBundle,
    state: PluginState,
): void => {
    if (!state.isBuild || state.bundleReferenceId === null) {
        return;
    }

    const fileName = ctx.getFileName(state.bundleReferenceId);
    const output = bundle[fileName];

    if (output?.type !== "asset") {
        throw new Error(`Cannot find the emitted ${BUNDLE_FILENAME} asset`);
    }

    if (state.entries.size === 0) {
        Reflect.deleteProperty(bundle, fileName);

        return;
    }

    const compiled = withStagingDir("resources-out", (outDir) => compileBundle(state, join(outDir, BUNDLE_FILENAME)));
    output.source = compiled;
    info(`Compiled ${String(state.entries.size)} resource(s) into ${BUNDLE_FILENAME}`);
};

const resolveResourceConfig = async (state: PluginState, config: UserConfig, loadConfig: ConfigLoader) => {
    const loaded = await loadConfig.load(viteProjectRoot(config));
    state.prefix = resourceBasePath(loaded.config.applicationId);
    state.root = loaded.root;

    return {
        assetsInclude: [ASSET_RE],
    };
};

const attachResourceWatcher = (state: PluginState, server: ViteDevServer): void => {
    state.server = server;

    const onClose = (): void => {
        releaseStagingDir(state);
    };

    server.httpServer?.once("close", onClose);
    server.watcher.once("close", onClose);
};

const applyResolvedConfig = (state: PluginState, config: ResolvedConfig): void => {
    state.isBuild = config.command === "build";
    state.root = config.root;
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

const rejectInvalidSpecifier = (source: string): void => {
    if (BUNDLED_QUERY_MENTION_RE.test(source)) {
        throw new Error(
            `${JSON.stringify(source)} is not a valid bundled asset import; use ?resource, ` +
                "?resource=/absolute/path, ?icon, or ?icon=name",
        );
    }

    if (isBareRelativeAsset(source)) {
        throw new Error(
            `${JSON.stringify(source)} must choose ?resource for a GResource, ?icon for a themed icon, ` +
                "?font for a bundled font, or ?url for an emitted file",
        );
    }
};

const resolveExplicitResourceId = async (
    ctx: ResolveContext,
    state: PluginState,
    request: ResolveRequest,
): Promise<string | undefined> => {
    const specifier = parseResourceSpecifier(request.source);

    if (specifier === null) {
        return undefined;
    }

    const entry = await resolveAssetEntry(ctx, state, {
        assetSource: specifier.assetSource,
        importer: request.importer,
        resourcePath: specifier.resourcePath,
        options: request.options,
    });

    return virtualAssetId(entry);
};

const resolveIconResourceId = async (
    ctx: ResolveContext,
    state: PluginState,
    request: ResolveRequest,
): Promise<RetainedIconModuleId | undefined> => {
    const specifier = parseIconSpecifier(request.source);

    if (specifier === null) {
        return undefined;
    }

    const resolved = await resolveIconEntry(ctx, state, {
        assetSource: specifier.assetSource,
        iconName: specifier.iconName,
        importer: request.importer,
        options: request.options,
    });

    return { id: virtualIconId(resolved), moduleSideEffects: true };
};

const resolveBundledResourceId = async (
    ctx: ResolveContext,
    state: PluginState,
    request: ResolveRequest,
): Promise<ResourceModuleId | undefined> => {
    if (isLegacyDataSpecifier(request.source)) {
        throw new Error(
            `${JSON.stringify(request.source)} uses the legacy #data asset form; import it relatively with ` +
                "?resource or ?url",
        );
    }

    if (parseResourceSpecifier(request.source) !== null) {
        const resolved = await resolveExplicitResourceId(ctx, state, request);

        return resolved;
    }

    if (parseIconSpecifier(request.source) !== null) {
        const resolved = await resolveIconResourceId(ctx, state, request);

        return resolved;
    }

    rejectInvalidSpecifier(request.source);

    return undefined;
};

const resolveResourceId = (
    ctx: ResolveContext,
    state: PluginState,
    request: ResolveRequest,
): Promise<ResourceModuleId | undefined> => {
    if (request.source === VIRTUAL_INIT) {
        return Promise.resolve(VIRTUAL_INIT);
    }

    return resolveBundledResourceId(ctx, state, request);
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
        attachResourceWatcher(state, server);
    },

    buildStart() {
        if (state.isBuild && state.bundleReferenceId === null) {
            state.bundleReferenceId = this.emitFile({
                type: "asset",
                fileName: BUNDLE_FILENAME,
                source: "",
            });
        }
    },

    resolveId(source, importer, options) {
        return resolveResourceId(this, state, { source, importer, options });
    },

    load: {
        filter: { id: { include: [VIRTUAL_INIT_RE, VIRTUAL_ID_RE] } },

        handler(id) {
            return loadResourceModule(state, id);
        },
    },

    transform(code, id) {
        return retainSideEffectIconImport(code, id);
    },

    generateBundle(_options, bundle) {
        finalizeBuildBundle(this, bundle, state);
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
        entries: new Map(),
        stagingDir: createRetainedStagingDir(DEV_STAGING_PREFIX),
        devBundlePath: "",
        server: null,
        compiledSignature: "",
        bundleReferenceId: null,
        iconOwners: new Map(),
    };

    return createResourcesPlugin(state, loadConfig);
}

export { gtkxResources };
