import { type ApiReference, type ApiSymbol, loadApiReference, resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import { loadConfig } from "@gtkx/config";
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type CallToolResult, ErrorCode, McpError, type ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { defineTool, textContent, textError, type Tool, type ToolArgs } from "./tool.js";

type ReferenceApi = Pick<
    ApiReference,
    "lookup" | "namespaceOverview" | "namespaces" | "overview" | "search" | "symbolNames"
>;

type ProjectSource = "argument" | "workingDirectory" | "app";

type ResolvedProject = {
    root: string;
    source: ProjectSource;
};

type ScopedReference = ResolvedProject & {
    reference: ReferenceApi;
};

type ReferenceProviderOptions = {
    getAppRoot: () => string | undefined;
    getWorkingDirectory?: () => string;
};

type ReferenceProvider = {
    get(projectRoot?: string): Promise<ScopedReference>;
    load(project: ResolvedProject): Promise<ScopedReference>;
    resolve(projectRoot?: string): ResolvedProject;
};

type WatchedFile = {
    path: string;
    mtimeMs: number;
    size: number;
};

type LoadedReference = {
    reference: ApiReference;
    root: string;
    watched: WatchedFile[];
};

type CacheEntry = {
    pending: Promise<LoadedReference>;
    verifiedAt: number;
    failedAt: number | undefined;
};

type ReferenceCache = Map<string, CacheEntry>;
type SearchOptions = Parameters<ReferenceApi["search"]>[0];
type ResourceServer = Pick<McpServer, "registerResource">;

const FRESHNESS_INTERVAL_MS = 2000;
const FAILURE_RETRY_MS = 5000;
const CONFIG_EXTENSIONS = ["ts", "mts", "cts", "js", "mjs", "cjs", "json"];

const PROJECT_SOURCE_LABELS: Record<ProjectSource, string> = {
    argument: "requested with `projectRoot`",
    workingDirectory: "found from the working directory",
    app: "taken from a connected app; pass `projectRoot` to document another project",
};

const SYMBOL_KIND = z.enum([
    "element",
    "class",
    "interface",
    "record",
    "enum",
    "callback",
    "alias",
    "function",
    "constant",
]);

const SYMBOL_DESCRIPTION =
    "Qualified symbol name (`Gtk.Button`, `Gtk.Orientation`, `GLib.idleAdd`), JSX element name (`GtkButton`), " +
    "or bare symbol name when unambiguous (`Button`).";

const PROJECT_ROOT_DESCRIPTION =
    "Directory of the GTKX project whose bindings to document, absolute or relative to the working directory. " +
    "Any directory inside the project works; its `gtkx.config.ts` decides the documented libraries. Omit to use " +
    "the project containing the working directory, falling back to a connected app's project.";

const projectRootShape = {
    projectRoot: z.string().optional().describe(PROJECT_ROOT_DESCRIPTION),
};

const listApiShape = {
    ...projectRootShape,
    namespace: z
        .string()
        .optional()
        .describe("Namespace to list (e.g. `Gtk`, `Adw`, `Gio`). Omit for an overview of all namespaces."),
};

const searchApiShape = {
    ...projectRootShape,
    query: z.string().describe("Case-insensitive substring of a symbol name, e.g. `headerbar` or `orientation`."),
    namespace: z.string().optional().describe("Restrict matches to one namespace (e.g. `Gtk`)."),
    kind: SYMBOL_KIND.optional().describe("Restrict matches to one symbol kind."),
    limit: z.number().int().min(1).optional().describe("Maximum number of results (default: 20)."),
};

const apiDocsShape = {
    ...projectRootShape,
    symbol: z.string().describe(SYMBOL_DESCRIPTION),
    kind: SYMBOL_KIND.optional().describe("Disambiguate when several kinds share the symbol name."),
};

const watchFile = (path: string): WatchedFile => {
    try {
        const stats = statSync(path);

        return { path, mtimeMs: stats.mtimeMs, size: stats.size };
    } catch {
        return { path, mtimeMs: -1, size: -1 };
    }
};

const isFresh = (loaded: LoadedReference): boolean =>
    loaded.watched.every((file) => {
        const current = watchFile(file.path);

        return current.mtimeMs === file.mtimeMs && current.size === file.size;
    });

const hasConfigFile = (directory: string): boolean =>
    CONFIG_EXTENSIONS.some((extension) => existsSync(join(directory, `gtkx.config.${extension}`)));

const findProjectRoot = (start: string): string | undefined => {
    const current = resolve(start);
    const parent = dirname(current);

    if (hasConfigFile(current)) {
        return current;
    }

    return parent === current ? undefined : findProjectRoot(parent);
};

const projectAt = (candidate: string, source: ProjectSource): ResolvedProject => ({
    root: findProjectRoot(candidate) ?? resolve(candidate),
    source,
});

const resolveProject = (
    workingDirectory: string,
    getAppRoot: () => string | undefined,
    projectRoot: string | undefined,
): ResolvedProject => {
    if (projectRoot !== undefined) {
        return projectAt(projectRoot, "argument");
    }

    const discovered = findProjectRoot(workingDirectory);

    if (discovered !== undefined) {
        return { root: discovered, source: "workingDirectory" };
    }

    const appRoot = getAppRoot();

    return appRoot === undefined
        ? { root: resolve(workingDirectory), source: "workingDirectory" }
        : projectAt(appRoot, "app");
};

const loadReference = async (requestedRoot: string): Promise<LoadedReference> => {
    const { config, configFile, root } = await loadConfig(requestedRoot);

    if (config.codegen === false) {
        throw new Error(
            `codegen is disabled for the project at ${root}, so there are no generated bindings to document. ` +
            "Remove `codegen: false` from gtkx.config.ts to use the API reference, or point the `projectRoot` " +
            "argument at another project.",
        );
    }

    const girPath = resolveGirPath(config.girPath);

    if (girPath.length === 0) {
        throw new Error(
            "No GIR search paths available. Install gobject-introspection " +
            "(Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), " +
            "or set `girPath` in gtkx.config.ts.",
        );
    }

    const libraries = resolveLibraries(config.libraries, girPath);

    const reference = loadApiReference({
        libraries,
        girPath,
        isByteArrayTyped: config.future?.v2ByteArrays === true,
        isValueUnwrapped: config.future?.v2ValueReturns === true,
    });

    const watched = [watchFile(resolve(root, configFile)), ...reference.girFiles.map((file) => watchFile(file))];

    return { reference, root, watched };
};

const markFailed = async (entry: CacheEntry): Promise<void> => {
    try {
        await entry.pending;
    } catch {
        entry.failedAt = Date.now();
    }
};

const startLoad = (cache: ReferenceCache, root: string): CacheEntry => {
    const entry: CacheEntry = { pending: loadReference(root), verifiedAt: Date.now(), failedAt: undefined };
    void markFailed(entry);
    cache.set(root, entry);

    return entry;
};

const isRetryDue = (entry: CacheEntry): boolean =>
    entry.failedAt !== undefined && Date.now() - entry.failedAt >= FAILURE_RETRY_MS;

const resolveEntry = (cache: ReferenceCache, root: string): CacheEntry => {
    const entry = cache.get(root) ?? startLoad(cache, root);

    return isRetryDue(entry) ? startLoad(cache, root) : entry;
};

const revalidate = (cache: ReferenceCache, root: string, entry: CacheEntry): CacheEntry => {
    const current = cache.get(root);

    return current === undefined || current === entry ? startLoad(cache, root) : current;
};

const currentReference = async (cache: ReferenceCache, root: string): Promise<LoadedReference> => {
    const entry = resolveEntry(cache, root);
    const loaded = await entry.pending;

    if (Date.now() - entry.verifiedAt < FRESHNESS_INTERVAL_MS) {
        return loaded;
    }

    if (isFresh(loaded)) {
        entry.verifiedAt = Date.now();

        return loaded;
    }

    return revalidate(cache, root, entry).pending;
};

const defaultWorkingDirectory = (): string => process.cwd();

const createReferenceProvider = (options: ReferenceProviderOptions): ReferenceProvider => {
    const cache: ReferenceCache = new Map();
    const getWorkingDirectory = options.getWorkingDirectory ?? defaultWorkingDirectory;

    const resolve = (projectRoot?: string): ResolvedProject =>
        resolveProject(getWorkingDirectory(), options.getAppRoot, projectRoot);

    const load = async (project: ResolvedProject): Promise<ScopedReference> => {
        const loaded = await currentReference(cache, project.root);

        return { reference: loaded.reference, root: loaded.root, source: project.source };
    };

    const get = (projectRoot?: string): Promise<ScopedReference> => load(resolve(projectRoot));

    return { get, load, resolve };
};

const projectNote = (project: ResolvedProject): string =>
    `Project: ${project.root} (${PROJECT_SOURCE_LABELS[project.source]})`;

const withProjectNote = (result: CallToolResult, note: string): CallToolResult => ({
    ...result,
    content: [...result.content, { type: "text", text: note }],
});

const scopedResult = async (
    provider: ReferenceProvider,
    projectRoot: string | undefined,
    render: (reference: ReferenceApi) => CallToolResult,
): Promise<CallToolResult> => {
    const resolved = provider.resolve(projectRoot);

    try {
        const scoped = await provider.load(resolved);

        return withProjectNote(render(scoped.reference), projectNote(scoped));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return withProjectNote(textError(message), projectNote(resolved));
    }
};

const formatCandidates = (candidates: ApiSymbol[]): string =>
    candidates.map((candidate) => `- ${candidate.namespace}.${candidate.name} (${candidate.kind})`).join("\n");

const buildSearchOptions = (args: ToolArgs<typeof searchApiShape>): SearchOptions => {
    const options: SearchOptions = { query: args.query };

    if (args.namespace !== undefined) {
        options.namespace = args.namespace;
    }

    if (args.kind !== undefined) {
        options.kinds = [args.kind];
    }

    if (args.limit !== undefined) {
        options.limit = args.limit;
    }

    return options;
};

const listApiResult = (reference: ReferenceApi, namespace: string | undefined): CallToolResult => {
    if (namespace === undefined) {
        return textContent(reference.overview());
    }

    const overview = reference.namespaceOverview(namespace);

    if (overview === undefined) {
        const names = reference
            .namespaces()
            .map((summary) => summary.name)
            .join(", ");

        return textError(`Unknown namespace "${namespace}". Available namespaces: ${names}`);
    }

    return textContent(overview);
};

const searchApiResult = (reference: ReferenceApi, args: ToolArgs<typeof searchApiShape>): CallToolResult => {
    const results = reference.search(buildSearchOptions(args));

    if (results.length === 0) {
        return textContent(`No symbols matched "${args.query}". Try a shorter substring or \`gtkx_list_api\`.`);
    }

    return textContent(JSON.stringify(results, null, 2));
};

const apiDocsResult = (reference: ReferenceApi, args: ToolArgs<typeof apiDocsShape>): CallToolResult => {
    const result = reference.lookup(args.symbol, args.kind);

    if (result.outcome === "notFound") {
        return textError(`No symbol named "${args.symbol}". Use \`gtkx_search_api\` to find the right name.`);
    }

    if (result.outcome === "ambiguous") {
        return textError(
            `"${args.symbol}" matches several symbols. Pass a qualified name or a kind:\n` +
            formatCandidates(result.candidates),
        );
    }

    return textContent(result.markdown);
};

const listApiTool = (provider: ReferenceProvider): Tool =>
    defineTool({
        name: "gtkx_list_api",
        title: "List API reference",
        kind: "readOnly",
        description:
            "List the project's generated GTK4 bindings API (`@gtkx/gi` and `@gtkx/jsx`). Without a namespace, " +
            "returns every namespace with symbol counts; with a namespace, lists all of its symbols grouped by kind.",
        inputSchema: listApiShape,
        handler: ({ namespace, projectRoot }) =>
            scopedResult(provider, projectRoot, (reference) => listApiResult(reference, namespace)),
    });

const searchApiTool = (provider: ReferenceProvider): Tool =>
    defineTool({
        name: "gtkx_search_api",
        title: "Search API reference",
        kind: "readOnly",
        description:
            "Search the project's generated GTK4 bindings API by symbol name. Returns matching symbols with " +
            "their namespace, kind, and a one-line summary; fetch full pages with `gtkx_get_api_docs`.",
        inputSchema: searchApiShape,
        handler: (args) => scopedResult(provider, args.projectRoot, (reference) => searchApiResult(reference, args)),
    });

const getApiDocsTool = (provider: ReferenceProvider): Tool =>
    defineTool({
        name: "gtkx_get_api_docs",
        title: "Get API docs",
        kind: "readOnly",
        description:
            "Get the full reference page for one symbol of the project's generated GTK4 bindings: JSX elements " +
            "(props, signals, methods) or `@gtkx/gi` classes, interfaces, records, enums, callbacks, aliases, " +
            "functions, and constants.",
        inputSchema: apiDocsShape,
        handler: (args) => scopedResult(provider, args.projectRoot, (reference) => apiDocsResult(reference, args)),
    });

const buildReferenceTools = (provider: ReferenceProvider): Tool[] => [
    listApiTool(provider),
    searchApiTool(provider),
    getApiDocsTool(provider),
];

const markdownResource = (uri: URL, text: string): ReadResourceResult => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
});

const variableValue = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const withLoadFallback = async <T>(load: () => Promise<T>, fallback: T): Promise<T> => {
    try {
        return await load();
    } catch {
        return fallback;
    }
};

const namesStartingWith = (names: string[], value: string): string[] =>
    names.filter((name) => name.toLowerCase().startsWith(value.toLowerCase()));

const completeNames = (
    provider: ReferenceProvider,
    value: string,
    collect: (reference: ReferenceApi) => string[],
): Promise<string[]> =>
    withLoadFallback(async () => {
        const { reference } = await provider.get();

        return namesStartingWith(collect(reference), value);
    }, []);

const namespaceCompleter =
    (provider: ReferenceProvider) =>
        (value: string): Promise<string[]> =>
            completeNames(provider, value, (reference) => reference.namespaces().map((summary) => summary.name));

const completeSymbol = (provider: ReferenceProvider, namespace: string, value: string): Promise<string[]> => {
    if (namespace.length === 0) {
        return Promise.resolve([]);
    }

    return completeNames(provider, value, (reference) => reference.symbolNames(namespace));
};

const resourceNotFound = (message: string): McpError => new McpError(ErrorCode.InvalidParams, message);

const symbolPage = async (
    uri: URL,
    provider: ReferenceProvider,
    namespace: string,
    symbol: string,
): Promise<ReadResourceResult> => {
    const { reference } = await provider.get();
    const result = reference.lookup(`${namespace}.${symbol}`);

    if (result.outcome === "page") {
        return markdownResource(uri, result.markdown);
    }

    if (result.outcome === "ambiguous") {
        throw resourceNotFound(
            `"${namespace}.${symbol}" matches several symbols:\n${formatCandidates(result.candidates)}`,
        );
    }

    throw resourceNotFound(`No symbol named "${namespace}.${symbol}"`);
};

const registerIndexResource = (server: ResourceServer, provider: ReferenceProvider): void => {
    server.registerResource(
        "gtkx-api-reference",
        "gtkx://reference/index",
        {
            title: "GTKX API reference index",
            description: "Namespaces of the project's generated GTK4 bindings, with symbol and JSX element counts.",
            mimeType: "text/markdown",
        },
        async (uri) => {
            const { reference } = await provider.get();

            return markdownResource(uri, reference.overview());
        },
    );
};

const registerNamespaceResource = (server: ResourceServer, provider: ReferenceProvider): void => {
    server.registerResource(
        "gtkx-api-namespace",
        new ResourceTemplate("gtkx://reference/{namespace}", {
            list: () =>
                withLoadFallback(
                    async () => {
                        const { reference } = await provider.get();

                        return {
                            resources: reference.namespaces().map((summary) => ({
                                uri: `gtkx://reference/${summary.name}`,
                                name: `${summary.name} namespace reference`,
                                mimeType: "text/markdown",
                            })),
                        };
                    },
                    { resources: [] },
                ),
            complete: {
                namespace: namespaceCompleter(provider),
            },
        }),
        {
            title: "GTKX namespace reference",
            description: "All symbols of one namespace of the project's generated GTK4 bindings, grouped by kind.",
            mimeType: "text/markdown",
        },
        async (uri, variables) => {
            const namespace = variableValue(variables.namespace);
            const { reference } = await provider.get();
            const overview = reference.namespaceOverview(namespace);

            if (overview === undefined) {
                throw resourceNotFound(`Unknown namespace "${namespace}"`);
            }

            return markdownResource(uri, overview);
        },
    );
};

const registerSymbolResource = (server: ResourceServer, provider: ReferenceProvider): void => {
    server.registerResource(
        "gtkx-api-symbol",
        new ResourceTemplate("gtkx://reference/{namespace}/{symbol}", {
            list: undefined,
            complete: {
                namespace: namespaceCompleter(provider),
                symbol: (value, context) =>
                    completeSymbol(provider, variableValue(context?.arguments?.namespace), value),
            },
        }),
        {
            title: "GTKX symbol reference",
            description:
                "Reference page for one symbol of the project's generated GTK4 bindings: a JSX element or a " +
                "class, interface, record, enum, callback, alias, function, or constant.",
            mimeType: "text/markdown",
        },
        (uri, variables) =>
            symbolPage(uri, provider, variableValue(variables.namespace), variableValue(variables.symbol)),
    );
};

const registerReferenceResources = (server: ResourceServer, provider: ReferenceProvider): void => {
    registerIndexResource(server, provider);
    registerNamespaceResource(server, provider);
    registerSymbolResource(server, provider);
};

export {
    createReferenceProvider,
    buildReferenceTools,
    registerReferenceResources,
    type ReferenceProvider,
};
