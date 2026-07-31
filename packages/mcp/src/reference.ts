import { type ApiReference, type ApiSymbol, loadApiReference, resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import { loadConfig } from "@gtkx/config";
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError, type ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { defineTool, textContent, textError, type Tool, type ToolArgs } from "./tool.js";

type ReferenceApi = Pick<
    ApiReference,
    "lookup" | "namespaceOverview" | "namespaces" | "overview" | "search" | "symbolNames"
>;

type ReferenceProvider = {
    get(): Promise<ReferenceApi>;
};

type WatchedFile = {
    path: string;
    mtimeMs: number;
    size: number;
};

type LoadedReference = {
    reference: ApiReference;
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

const listApiShape = {
    namespace: z
        .string()
        .optional()
        .describe("Namespace to list (e.g. `Gtk`, `Adw`, `Gio`). Omit for an overview of all namespaces."),
};

const searchApiShape = {
    query: z.string().describe("Case-insensitive substring of a symbol name, e.g. `headerbar` or `orientation`."),
    namespace: z.string().optional().describe("Restrict matches to one namespace (e.g. `Gtk`)."),
    kind: SYMBOL_KIND.optional().describe("Restrict matches to one symbol kind."),
    limit: z.number().int().min(1).optional().describe("Maximum number of results (default: 20)."),
};

const apiDocsShape = {
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

const loadReference = async (root: string): Promise<LoadedReference> => {
    const { config, configFile } = await loadConfig(root);

    if (config.codegen === false) {
        throw new Error(
            `codegen is disabled for the project at ${root}, so there are no generated bindings to document. ` +
            "Remove `codegen: false` from gtkx.config.ts to use the API reference.",
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
    const reference = loadApiReference({ libraries, girPath });
    const watched = [watchFile(resolve(root, configFile)), ...reference.girFiles.map((file) => watchFile(file))];

    return { reference, watched };
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

const currentReference = async (cache: ReferenceCache, root: string): Promise<ReferenceApi> => {
    const entry = resolveEntry(cache, root);
    const loaded = await entry.pending;

    if (Date.now() - entry.verifiedAt < FRESHNESS_INTERVAL_MS) {
        return loaded.reference;
    }

    if (isFresh(loaded)) {
        entry.verifiedAt = Date.now();

        return loaded.reference;
    }

    const revalidated = await revalidate(cache, root, entry).pending;

    return revalidated.reference;
};

const createReferenceProvider = (resolveRoot: () => string): ReferenceProvider => {
    const cache: ReferenceCache = new Map();

    return {
        get: () => currentReference(cache, resolve(resolveRoot())),
    };
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

const listApiTool = (provider: ReferenceProvider): Tool =>
    defineTool({
        name: "gtkx_list_api",
        title: "List API reference",
        kind: "readOnly",
        description:
            "List the project's generated GTK4 bindings API (`@gtkx/gi` and `@gtkx/jsx`). Without a namespace, " +
            "returns every namespace with symbol counts; with a namespace, lists all of its symbols grouped by kind.",
        inputSchema: listApiShape,
        handler: async ({ namespace }) => {
            const reference = await provider.get();

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
        },
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
        handler: async (args) => {
            const reference = await provider.get();
            const results = reference.search(buildSearchOptions(args));

            if (results.length === 0) {
                return textContent(`No symbols matched "${args.query}". Try a shorter substring or \`gtkx_list_api\`.`);
            }

            return textContent(JSON.stringify(results, null, 2));
        },
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
        handler: async ({ symbol, kind }) => {
            const reference = await provider.get();
            const result = reference.lookup(symbol, kind);

            if (result.outcome === "notFound") {
                return textError(`No symbol named "${symbol}". Use \`gtkx_search_api\` to find the right name.`);
            }

            if (result.outcome === "ambiguous") {
                return textError(
                    `"${symbol}" matches several symbols. Pass a qualified name or a kind:\n` +
                    formatCandidates(result.candidates),
                );
            }

            return textContent(result.markdown);
        },
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

const namespaceCompleter =
    (provider: ReferenceProvider) =>
        (value: string): Promise<string[]> =>
            withLoadFallback(async () => {
                const reference = await provider.get();

                return reference
                    .namespaces()
                    .map((summary) => summary.name)
                    .filter((name) => name.toLowerCase().startsWith(value.toLowerCase()));
            }, []);

const completeSymbol = async (provider: ReferenceProvider, namespace: string, value: string): Promise<string[]> => {
    if (namespace.length === 0) {
        return [];
    }

    return withLoadFallback(async () => {
        const reference = await provider.get();

        return reference.symbolNames(namespace).filter((name) => name.toLowerCase().startsWith(value.toLowerCase()));
    }, []);
};

const resourceNotFound = (message: string): McpError => new McpError(ErrorCode.InvalidParams, message);

const symbolPage = async (
    uri: URL,
    provider: ReferenceProvider,
    namespace: string,
    symbol: string,
): Promise<ReadResourceResult> => {
    const reference = await provider.get();
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
            const reference = await provider.get();

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
                        const reference = await provider.get();

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
            const reference = await provider.get();
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
    type ReferenceApi,
    type ReferenceProvider,
};
