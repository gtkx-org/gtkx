import type { ConfigLoader } from "@gtkx/config";
import type { ModuleNode, Plugin, ResolvedConfig, Rolldown, UserConfig, ViteDevServer } from "vite";
import { createConfigLoader, resourceBasePath } from "@gtkx/config/internal";
import { error, info, isRecord, sortStrings } from "@gtkx/utils";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, posix, relative, sep } from "node:path";
import { parseSync } from "vite";
import { runCliTool } from "../internal/run-cli-tool.js";
import { parseRuntimeImportsIn, type SourceImport, sourceLanguage } from "../internal/source-imports.js";
import { createRetainedStagingDir, type RetainedStagingDir, withStagingDir } from "../internal/staging-dir.js";
import { ASSET_RE } from "./asset-extensions.js";
import {
    isBareRelativeAsset,
    parseIconSpecifier,
    parseResourceSpecifier,
} from "./asset-specifier.js";
import { renderInitModule } from "./resource-init-module.js";
import {
    BUNDLE_FILENAME,
    escapeXml,
    fromVirtualId,
    ICON_NAME_SEPARATOR,
    isVirtual,
    REFRESH_EXPORT,
    REGISTER_REFRESH_EXPORT,
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
    entries: Map<string, ResourceEntry>;
    bundledSpecifiers: Map<string, Set<string>>;
    moduleDependencies: Map<string, Set<string>>;
    prunedDependencies: Map<string, Set<string>>;
    declaredEntries: Map<string, Map<string, ResourceEntry>>;
    declaredIcons: Map<string, Map<string, ResourceEntry>>;
    entryModule: string | null;
    sourcePaths: Set<string>;
    missingSourcePaths: Set<string>;
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

type ImporterReconciliation = {
    currentBundled: Set<string>;
    currentDependencies: Set<string>;
    file: string;
    imports: SourceImport[];
    key: string;
    previousBundled: Set<string> | undefined;
    previousDependencies: Set<string> | undefined;
};

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
    const parts = toForwardSlashes(sourcePath).split("/");

    return iconLayoutInParts(parts, parts.length - 2);
};

const derivedIconEntry = (
    state: PluginState,
    sourcePath: string,
    requestedName: string | null,
): DerivedIconEntry => {
    const extension = iconExtension(sourcePath);
    const sourceName = basename(sourcePath, extname(sourcePath));
    const iconName = validateIconName(requestedName ?? sourceName);
    const layout = iconLayoutFromTree(sourcePath);

    const iconIdentity = layout === null
        ? `${state.prefix}/icons/${iconName}`
        : `${state.prefix}/icons/${layout}/${iconName}`;

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

const retainSideEffectIconImport = (
    code: string,
    id: string,
): { code: string; moduleSideEffects: true } | null =>
    hasSideEffectIconImport(code, id)
        ? { code, moduleSideEffects: true }
        : null;

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

const isRefreshHook = (value: unknown): value is () => void => typeof value === "function";

const refreshRegisteredDevBundle = (state: PluginState): void => {
    const server = state.server;

    if (!server) {
        return;
    }

    const refresh: unknown = server.moduleGraph.getModuleById(VIRTUAL_INIT)?.ssrModule?.[REFRESH_EXPORT];

    if (isRefreshHook(refresh)) {
        refresh();
    }
};

const registerDevAsset = (state: PluginState): void => {
    if (entriesSignature(state) !== state.compiledSignature) {
        compileDevBundle(state);
    }
};

const importerKey = (importer: string): string => stripQuery(importer);

const trackBundledSpecifier = (state: PluginState, importer: string | undefined, source: string): void => {
    if (importer === undefined) {
        return;
    }

    const key = importerKey(importer);
    const specifiers = state.bundledSpecifiers.get(key) ?? new Set<string>();
    specifiers.add(source);
    state.bundledSpecifiers.set(key, specifiers);
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
    state.sourcePaths.add(entry.sourcePath);

    return entry;
};

const isDeclarativeImporter = (state: PluginState, importer: string | undefined): importer is string =>
    !state.isBuild && importer !== undefined;

const setSourceAvailability = (state: PluginState, file: string, isAvailable: boolean): void => {
    if (isAvailable) {
        state.missingSourcePaths.delete(file);

        return;
    }

    state.missingSourcePaths.add(file);
};

const isDeclaredSourceAvailable = (state: PluginState, sourcePath: string): boolean => {
    const isAvailable = existsSync(sourcePath);
    setSourceAvailability(state, sourcePath, isAvailable);

    return isAvailable;
};

const declareEntry = (state: PluginState, importer: string, entry: ResourceEntry): ResourceEntry => {
    const key = importerKey(importer);
    const declarations = state.declaredEntries.get(key) ?? new Map<string, ResourceEntry>();
    const existing = declarations.get(entry.resourcePath);

    if (existing !== undefined && existing.sourcePath !== entry.sourcePath) {
        throw new Error(
            `${existing.sourcePath} and ${entry.sourcePath} both resolve to the GResource path ` +
            entry.resourcePath,
        );
    }

    const declared = existing ?? entry;
    declarations.set(entry.resourcePath, declared);
    state.declaredEntries.set(key, declarations);
    state.server?.watcher.add(dirname(declared.sourcePath));

    return declared;
};

const declareIcon = (
    state: PluginState,
    importer: string,
    iconIdentity: string,
    entry: ResourceEntry,
): void => {
    const key = importerKey(importer);
    const declarations = state.declaredIcons.get(key) ?? new Map<string, ResourceEntry>();
    const existing = declarations.get(iconIdentity);

    if (existing !== undefined && existing.sourcePath !== entry.sourcePath) {
        throw new Error(
            `${existing.sourcePath} and ${entry.sourcePath} both claim the themed icon ${iconIdentity}`,
        );
    }

    declarations.set(iconIdentity, existing ?? entry);
    state.declaredIcons.set(key, declarations);
};

const assertIconIdentityAvailable = (
    state: PluginState,
    iconIdentity: string,
    sourcePath: string,
): void => {
    const existing = state.iconOwners.get(iconIdentity);

    if (existing !== undefined && existing.sourcePath !== sourcePath) {
        throw new Error(
            `${existing.sourcePath} and ${sourcePath} both claim the themed icon ${iconIdentity}`,
        );
    }
};

const declareResolvedIcon = (
    state: PluginState,
    importer: string | undefined,
    iconIdentity: string,
    entry: ResourceEntry,
): void => {
    if (isDeclarativeImporter(state, importer)) {
        declareIcon(state, importer, iconIdentity, entry);
    }
};

const registerEntry = (
    state: PluginState,
    absPath: string,
    rel: string,
    importer?: string,
): ResourceEntry => {
    const resourcePath = validateResourcePath(rel.startsWith("/") ? rel : `${state.prefix}/${rel}`);
    let entry = createResourceEntry(absPath, resourcePath);

    if (isDeclarativeImporter(state, importer)) {
        entry = declareEntry(state, importer, entry);

        if (!isImporterActive(state, importer) || !isDeclaredSourceAvailable(state, absPath)) {
            return entry;
        }
    }

    return activateEntry(state, entry);
};

const registerIconEntry = (
    state: PluginState,
    sourcePath: string,
    derived: DerivedIconEntry,
    importer: string | undefined,
): ResourceEntry => {
    const shouldActivate = !isDeclarativeImporter(state, importer) ||
        (isImporterActive(state, importer) && isDeclaredSourceAvailable(state, sourcePath));

    if (shouldActivate) {
        assertIconIdentityAvailable(state, derived.iconIdentity, sourcePath);
    }

    const entry = registerEntry(state, sourcePath, derived.resourcePath, importer);
    declareResolvedIcon(state, importer, derived.iconIdentity, entry);

    if (shouldActivate) {
        state.iconOwners.set(derived.iconIdentity, entry);
    }

    return entry;
};

const isTrackedSource = (state: PluginState, file: string): boolean => state.sourcePaths.has(file);

const hasSourceEntry = (entries: Map<string, ResourceEntry>, file: string): boolean => {
    for (const entry of entries.values()) {
        if (entry.sourcePath === file) {
            return true;
        }
    }

    return false;
};

const hasDeclaredSource = (
    declarations: Map<string, Map<string, ResourceEntry>>,
    file: string,
): boolean => {
    for (const entries of declarations.values()) {
        if (hasSourceEntry(entries, file)) {
            return true;
        }
    }

    return false;
};

const isDeclaredSource = (state: PluginState, file: string): boolean =>
    hasDeclaredSource(state.declaredEntries, file) || hasDeclaredSource(state.declaredIcons, file);

const virtualAssetId = (entry: ResourceEntry): string =>
    toVirtualId(entry.sourcePath) + REL_SEPARATOR + entry.resourcePath;

const virtualIconId = ({ entry, iconName }: ResolvedIconEntry): string =>
    virtualAssetId(entry) + ICON_NAME_SEPARATOR + iconName;

const resolveAssetSource = async (
    ctx: ResolveContext,
    request: { assetSource: string; importer: string | undefined; options: Record<string, unknown> | undefined },
): Promise<string | undefined> => {
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

    return sourcePath;
};

const resolveAssetEntry = async (
    ctx: ResolveContext,
    state: PluginState,
    request: AssetResolveRequest,
): Promise<ResourceEntry | undefined> => {
    const sourcePath = await resolveAssetSource(ctx, request);

    if (sourcePath === undefined) {
        return undefined;
    }

    return registerEntry(
        state,
        sourcePath,
        request.resourcePath === null
            ? derivedResourcePath(state, sourcePath)
            : validateResourcePath(request.resourcePath),
        request.importer,
    );
};

const resolveIconEntry = async (
    ctx: ResolveContext,
    state: PluginState,
    request: IconResolveRequest,
): Promise<ResolvedIconEntry | undefined> => {
    const sourcePath = await resolveAssetSource(ctx, request);

    if (sourcePath === undefined) {
        return undefined;
    }

    const derived = derivedIconEntry(state, sourcePath, request.iconName);

    return {
        entry: registerIconEntry(state, sourcePath, derived, request.importer),
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
    const rest = fromVirtualId(virtualId);
    const separatorIndex = rest.indexOf(REL_SEPARATOR);
    const relAndMetadata = rest.slice(separatorIndex + REL_SEPARATOR.length);
    const iconSeparatorIndex = relAndMetadata.indexOf(ICON_NAME_SEPARATOR);

    return {
        absPath: rest.slice(0, separatorIndex),
        iconName: iconSeparatorIndex === -1
            ? null
            : relAndMetadata.slice(iconSeparatorIndex + ICON_NAME_SEPARATOR.length),
        rel: iconSeparatorIndex === -1 ? relAndMetadata : relAndMetadata.slice(0, iconSeparatorIndex),
    };
};

const resourcePathExport = (entry: ResourceEntry, iconName: string | null): string[] =>
    iconName === null ? [`export const ${RESOURCE_PATH_EXPORT} = ${JSON.stringify(entry.resourcePath)};`] : [];

const assetModuleImports = (iconName: string | null): string[] => {
    const initBindings = iconName === null
        ? "ensureRegistered"
        : `ensureRegistered, ${REGISTER_REFRESH_EXPORT}`;

    return [
        `import { ${initBindings} } from ${JSON.stringify(VIRTUAL_INIT)};`,
        ...(iconName === null
            ? []
            : [
                    "import { Display } from \"@gtkx/gi/gdk\";",
                    "import { IconTheme } from \"@gtkx/gi/gtk\";",
                ]),
    ];
};

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
        `${REGISTER_REFRESH_EXPORT}(resourceIconPath, refreshIconTheme);`,
    ];
};

const loadedResourceEntry = (
    state: PluginState,
    sourcePath: string,
    resourcePath: string,
): { entry: ResourceEntry; isRegistered: boolean } => {
    const registered = state.entries.get(resourcePath);

    if (registered === undefined) {
        return { entry: createResourceEntry(sourcePath, resourcePath), isRegistered: false };
    }

    if (registered.sourcePath !== sourcePath) {
        throw new Error(
            `${registered.sourcePath} and ${sourcePath} both resolve to the GResource path ${resourcePath}`,
        );
    }

    return { entry: registered, isRegistered: true };
};

const compileLoadedDevAsset = (state: PluginState, isRegistered: boolean): void => {
    if (isRegistered && !state.isBuild) {
        registerDevAsset(state);
    }
};

const loadAssetModule = (state: PluginState, virtualId: string): string => {
    const { absPath, iconName, rel } = virtualAssetMetadata(virtualId);
    const resourcePath = validateResourcePath(rel);
    const { entry, isRegistered } = loadedResourceEntry(state, absPath, resourcePath);
    const defaultValue = iconName ?? entry.resourcePath;
    compileLoadedDevAsset(state, isRegistered);

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

const refreshDevRegistration = (state: PluginState): void => {
    compileDevBundle(state);

    try {
        refreshRegisteredDevBundle(state);
    } catch (error_) {
        error("Failed to refresh GResource bundle:", error_);
    }
};

const isSameSpecifiers = (left: Set<string> | undefined, right: Set<string>): boolean =>
    left === undefined
        ? right.size === 0
        : left.size === right.size && [...right].every((source) => left.has(source));

const bundledSpecifiersIn = (imports: SourceImport[]): Set<string> =>
    new Set(
        imports
            .filter((entry) =>
                parseResourceSpecifier(entry.source) !== null || parseIconSpecifier(entry.source) !== null)
            .map((entry) => entry.source),
    );

const isSourceModule = (file: string): boolean => sourceLanguage(file) !== undefined;

const isBundledSource = (source: string): boolean =>
    parseResourceSpecifier(source) !== null || parseIconSpecifier(source) !== null;

const validateUnbundledSource = (source: string): void => {
    if (isLegacyDataSpecifier(source)) {
        throw new Error(`${JSON.stringify(source)} uses the legacy #data asset form`);
    }

    rejectInvalidSpecifier(source);
};

const resolvedModuleDependency = async (
    ctx: ResolveContext,
    source: string,
    importer: string,
): Promise<string | null> => {
    if (isBundledSource(source)) {
        return null;
    }

    validateUnbundledSource(source);
    const resolved = await ctx.resolve(source, importer, { skipSelf: true });

    if (resolved === null) {
        throw new Error(`${JSON.stringify(source)} could not be resolved from ${importer}`);
    }

    return resolved.external ? null : importerKey(resolved.id);
};

const resolvedModuleDependencies = async (
    ctx: ResolveContext,
    imports: SourceImport[],
    importer: string,
): Promise<Set<string>> => {
    const dependencies: Set<string> = new Set();

    for (const entry of imports) {
        const dependency = await resolvedModuleDependency(ctx, entry.source, importer);

        if (dependency !== null) {
            dependencies.add(dependency);
        }
    }

    return dependencies;
};

const importerReconciliation = async (
    ctx: ResolveContext,
    state: PluginState,
    id: string,
): Promise<ImporterReconciliation | null> => {
    const file = stripQuery(id);
    const key = importerKey(file);

    if (state.isBuild || !isSourceModule(file)) {
        return null;
    }

    const imports = parseRuntimeImportsIn(file);

    if (imports === null) {
        return null;
    }

    return {
        currentBundled: bundledSpecifiersIn(imports),
        currentDependencies: await resolvedModuleDependencies(ctx, imports, file),
        file,
        imports,
        key,
        previousBundled: state.bundledSpecifiers.get(key),
        previousDependencies: state.moduleDependencies.get(key),
    };
};

const moduleNodeKey = (module: ModuleNode): string => importerKey(module.id ?? module.file ?? module.url);

const moduleNodeFor = (state: PluginState, id: string): ModuleNode | undefined => {
    const server = state.server;

    if (server === null) {
        return undefined;
    }

    return server.moduleGraph.getModuleById(id) ?? server.moduleGraph.getModuleById(importerKey(id));
};

const restoreDependencies = (pruned: Set<string>, current: Set<string>): void => {
    for (const dependency of current) {
        pruned.delete(dependency);
    }
};

const pruneRemovedDependencies = (
    pruned: Set<string>,
    previous: Set<string> | undefined,
    current: Set<string>,
): void => {
    if (previous === undefined) {
        return;
    }

    for (const dependency of previous) {
        if (!current.has(dependency)) {
            pruned.add(dependency);
        }
    }
};

const storePrunedDependencies = (state: PluginState, key: string, pruned: Set<string>): void => {
    if (pruned.size === 0) {
        state.prunedDependencies.delete(key);

        return;
    }

    state.prunedDependencies.set(key, pruned);
};

const updatePrunedDependencies = (
    state: PluginState,
    key: string,
    previous: Set<string> | undefined,
    current: Set<string>,
): void => {
    const pruned = state.prunedDependencies.get(key) ?? new Set<string>();
    restoreDependencies(pruned, current);
    pruneRemovedDependencies(pruned, previous, current);
    storePrunedDependencies(state, key, pruned);
};

const isPrunedDependency = (state: PluginState, importer: ModuleNode, imported: ModuleNode): boolean =>
    state.prunedDependencies.get(moduleNodeKey(importer))?.has(moduleNodeKey(imported)) === true;

const fallbackRootModules = (state: PluginState): string[] => {
    const roots: string[] = [];

    for (const key of state.moduleDependencies.keys()) {
        if (moduleNodeFor(state, key)?.importers.size === 0) {
            roots.push(key);
        }
    }

    return roots;
};

const enqueueCurrentDependencies = (state: PluginState, key: string, pending: string[]): void => {
    const dependencies = state.moduleDependencies.get(key) ?? [];

    for (const dependency of dependencies) {
        pending.push(dependency);
    }
};

const enqueueGraphDependencies = (state: PluginState, key: string, pending: string[]): void => {
    const module = moduleNodeFor(state, key);

    if (module === undefined) {
        return;
    }

    for (const imported of module.importedModules) {
        if (!isPrunedDependency(state, module, imported)) {
            pending.push(moduleNodeKey(imported));
        }
    }
};

const visitActiveImporter = (
    state: PluginState,
    active: Set<string>,
    pending: string[],
    key: string,
): void => {
    if (active.has(key)) {
        return;
    }

    active.add(key);
    enqueueCurrentDependencies(state, key, pending);
    enqueueGraphDependencies(state, key, pending);
};

const activeImporterKeys = (state: PluginState): Set<string> => {
    const active: Set<string> = new Set();
    const roots = state.entryModule === null ? fallbackRootModules(state) : [state.entryModule];
    const pending = [...roots];

    while (pending.length > 0) {
        const key = pending.pop();

        if (key === undefined || active.has(key)) {
            continue;
        }

        visitActiveImporter(state, active, pending, key);
    }

    return active;
};

const isImporterActive = (state: PluginState, importer: string): boolean =>
    activeImporterKeys(state).has(importerKey(importer));

const activateDeclaredIcon = (
    state: PluginState,
    iconIdentity: string,
    entry: ResourceEntry,
): void => {
    const existing = state.iconOwners.get(iconIdentity);

    if (existing !== undefined && existing.sourcePath !== entry.sourcePath) {
        throw new Error(
            `${existing.sourcePath} and ${entry.sourcePath} both claim the themed icon ${iconIdentity}`,
        );
    }

    state.iconOwners.set(iconIdentity, activateEntry(state, entry));
};

const activateDeclaredEntries = (state: PluginState, importer: string): void => {
    const entries = state.declaredEntries.get(importer)?.values() ?? [];

    for (const entry of entries) {
        if (isDeclaredSourceAvailable(state, entry.sourcePath)) {
            activateEntry(state, entry);
        }
    }
};

const activateDeclaredIcons = (state: PluginState, importer: string): void => {
    const icons = state.declaredIcons.get(importer) ?? [];

    for (const [iconIdentity, entry] of icons) {
        if (isDeclaredSourceAvailable(state, entry.sourcePath)) {
            activateDeclaredIcon(state, iconIdentity, entry);
        }
    }
};

const activateDeclaredClaims = (state: PluginState, active: Set<string>): void => {
    for (const importer of sortStrings(active)) {
        activateDeclaredEntries(state, importer);
        activateDeclaredIcons(state, importer);
    }
};

const rebuildActiveClaims = (state: PluginState): void => {
    const previous = {
        entries: state.entries,
        iconOwners: state.iconOwners,
        sourcePaths: state.sourcePaths,
    };

    state.entries = new Map();
    state.iconOwners = new Map();
    state.sourcePaths = new Set();

    try {
        activateDeclaredClaims(state, activeImporterKeys(state));
    } catch (error_) {
        state.entries = previous.entries;
        state.iconOwners = previous.iconOwners;
        state.sourcePaths = previous.sourcePaths;
        throw error_;
    }
};

const forgetImporterDeclarations = (state: PluginState, importer: string): void => {
    state.declaredEntries.delete(importer);
    state.declaredIcons.delete(importer);
};

const cloneStringSetMap = (source: Map<string, Set<string>>): Map<string, Set<string>> => {
    const clone: Map<string, Set<string>> = new Map();

    for (const [key, values] of source) {
        clone.set(key, new Set(values));
    }

    return clone;
};

const cloneDeclarationMap = (
    source: Map<string, Map<string, ResourceEntry>>,
): Map<string, Map<string, ResourceEntry>> => {
    const clone: Map<string, Map<string, ResourceEntry>> = new Map();

    for (const [key, declarations] of source) {
        clone.set(key, new Map(declarations));
    }

    return clone;
};

const reconciliationCandidate = (state: PluginState): PluginState => ({
    ...state,
    bundledSpecifiers: cloneStringSetMap(state.bundledSpecifiers),
    moduleDependencies: cloneStringSetMap(state.moduleDependencies),
    prunedDependencies: cloneStringSetMap(state.prunedDependencies),
    declaredEntries: cloneDeclarationMap(state.declaredEntries),
    declaredIcons: cloneDeclarationMap(state.declaredIcons),
    missingSourcePaths: new Set(state.missingSourcePaths),
});

const storeBundledSpecifiers = (state: PluginState, importer: string, specifiers: Set<string>): void => {
    if (specifiers.size === 0) {
        state.bundledSpecifiers.delete(importer);

        return;
    }

    state.bundledSpecifiers.set(importer, specifiers);
};

const applyImporterGraph = (state: PluginState, reconciliation: ImporterReconciliation): void => {
    updatePrunedDependencies(
        state,
        reconciliation.key,
        reconciliation.previousDependencies,
        reconciliation.currentDependencies,
    );

    state.moduleDependencies.set(reconciliation.key, reconciliation.currentDependencies);
    storeBundledSpecifiers(state, reconciliation.key, reconciliation.currentBundled);
};

const declareReconciledResource = async (
    ctx: ResolveContext,
    state: PluginState,
    importer: string,
    source: string,
): Promise<void> => {
    const resourceSpecifier = parseResourceSpecifier(source);

    if (resourceSpecifier === null) {
        return;
    }

    const entry = await resolveAssetEntry(ctx, state, {
        assetSource: resourceSpecifier.assetSource,
        importer,
        resourcePath: resourceSpecifier.resourcePath,
        options: undefined,
    });

    if (entry === undefined || state.missingSourcePaths.has(entry.sourcePath)) {
        throw new Error(`${JSON.stringify(source)} did not resolve to a bundled resource`);
    }
};

const declareReconciledIcon = async (
    ctx: ResolveContext,
    state: PluginState,
    importer: string,
    source: string,
): Promise<void> => {
    const iconSpecifier = parseIconSpecifier(source);

    if (iconSpecifier === null) {
        return;
    }

    const entry = await resolveIconEntry(ctx, state, {
        assetSource: iconSpecifier.assetSource,
        iconName: iconSpecifier.iconName,
        importer,
        options: undefined,
    });

    if (entry === undefined || state.missingSourcePaths.has(entry.entry.sourcePath)) {
        throw new Error(`${JSON.stringify(source)} did not resolve to a bundled icon`);
    }
};

const declareReconciledSource = async (
    ctx: ResolveContext,
    state: PluginState,
    importer: string,
    source: string,
): Promise<void> => {
    await declareReconciledResource(ctx, state, importer, source);
    await declareReconciledIcon(ctx, state, importer, source);
};

const declareReconciledImports = async (
    ctx: ResolveContext,
    state: PluginState,
    reconciliation: ImporterReconciliation,
): Promise<void> => {
    for (const entry of reconciliation.imports) {
        if (isBundledSource(entry.source)) {
            await declareReconciledSource(ctx, state, reconciliation.file, entry.source);
        }
    }
};

const prepareReconciliation = async (
    ctx: ResolveContext,
    state: PluginState,
    reconciliation: ImporterReconciliation,
): Promise<PluginState> => {
    const candidate = reconciliationCandidate(state);

    const isBundledChanged = !isSameSpecifiers(
        reconciliation.previousBundled,
        reconciliation.currentBundled,
    );

    if (isBundledChanged) {
        forgetImporterDeclarations(candidate, reconciliation.key);
    }

    applyImporterGraph(candidate, reconciliation);
    rebuildActiveClaims(candidate);

    if (isBundledChanged) {
        await declareReconciledImports(ctx, candidate, reconciliation);
    }

    return candidate;
};

const commitReconciliation = (state: PluginState, candidate: PluginState): void => {
    state.entries = candidate.entries;
    state.bundledSpecifiers = candidate.bundledSpecifiers;
    state.moduleDependencies = candidate.moduleDependencies;
    state.prunedDependencies = candidate.prunedDependencies;
    state.declaredEntries = candidate.declaredEntries;
    state.declaredIcons = candidate.declaredIcons;
    state.missingSourcePaths = candidate.missingSourcePaths;
    state.sourcePaths = candidate.sourcePaths;
    state.iconOwners = candidate.iconOwners;
};

const reconcileImporter = async (ctx: ResolveContext, state: PluginState, id: string): Promise<void> => {
    const reconciliation = await importerReconciliation(ctx, state, id);

    if (reconciliation === null) {
        return;
    }

    const previousSignature = entriesSignature(state);
    const candidate = await prepareReconciliation(ctx, state, reconciliation);
    commitReconciliation(state, candidate);

    if (entriesSignature(state) !== previousSignature) {
        refreshDevRegistration(state);
    }
};

const resolveResourceConfig = async (state: PluginState, config: UserConfig, loadConfig: ConfigLoader) => {
    const loaded = await loadConfig.load(config.root ?? process.cwd());
    state.prefix = resourceBasePath(loaded.config.applicationId);
    state.root = loaded.root;

    return {
        assetsInclude: [ASSET_RE],
    };
};

const refreshTrackedSource = (state: PluginState, file: string): void => {
    if (!isTrackedSource(state, file)) {
        return;
    }

    try {
        refreshDevRegistration(state);
    } catch (error_) {
        error("GResource refresh failed:", error_);
    }
};

const rebuildForSourceAvailability = (state: PluginState, previousSignature: string): void => {
    try {
        rebuildActiveClaims(state);

        if (entriesSignature(state) !== previousSignature) {
            refreshDevRegistration(state);
        }
    } catch (error_) {
        error("GResource source update failed:", error_);
    }
};

const updateTrackedSourceAvailability = (state: PluginState, file: string, isAvailable: boolean): void => {
    if (!isTrackedSource(state, file) && !state.missingSourcePaths.has(file) && !isDeclaredSource(state, file)) {
        return;
    }

    const previousSignature = entriesSignature(state);
    setSourceAvailability(state, file, isAvailable);
    rebuildForSourceAvailability(state, previousSignature);
};

const attachResourceWatcher = (state: PluginState, server: ViteDevServer): void => {
    state.server = server;

    const onChange = (file: string): void => {
        refreshTrackedSource(state, file);
    };

    const onAdd = (file: string): void => {
        updateTrackedSourceAvailability(state, file, true);
    };

    const onUnlink = (file: string): void => {
        updateTrackedSourceAvailability(state, file, false);
    };

    const onClose = (): void => {
        releaseStagingDir(state);
    };

    server.httpServer?.once("close", onClose);
    server.watcher.once("close", onClose);
    server.watcher.on("change", onChange);
    server.watcher.on("add", onAdd);
    server.watcher.on("unlink", onUnlink);
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
            "or ?url for an emitted file",
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

    return entry === undefined ? undefined : virtualAssetId(entry);
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

    return resolved === undefined
        ? undefined
        : { id: virtualIconId(resolved), moduleSideEffects: true };
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
        trackBundledSpecifier(state, request.importer, request.source);

        return resolved;
    }

    if (parseIconSpecifier(request.source) !== null) {
        const resolved = await resolveIconResourceId(ctx, state, request);
        trackBundledSpecifier(state, request.importer, request.source);

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

    load(id) {
        return loadResourceModule(state, id);
    },

    async transform(code, id) {
        await reconcileImporter(this, state, id);

        return retainSideEffectIconImport(code, id);
    },

    generateBundle(_options, bundle) {
        finalizeBuildBundle(this, bundle, state);
    },

    closeBundle() {
        releaseStagingDir(state);
    },
});

function gtkxResources(loadConfig: ConfigLoader = createConfigLoader(), entryPath?: string): Plugin {
    const state: PluginState = {
        prefix: "",
        root: "",
        isBuild: false,
        entries: new Map(),
        bundledSpecifiers: new Map(),
        moduleDependencies: new Map(),
        prunedDependencies: new Map(),
        declaredEntries: new Map(),
        declaredIcons: new Map(),
        entryModule: entryPath === undefined ? null : importerKey(entryPath),
        sourcePaths: new Set(),
        missingSourcePaths: new Set(),
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
