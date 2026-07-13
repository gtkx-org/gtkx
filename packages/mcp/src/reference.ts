import { statSync } from "node:fs";
import { resolve } from "node:path";
import { ApiReference, type ApiSymbol, resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import { loadConfig } from "@gtkx/config";
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError, type ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { defineTool, type Tool, textContent, textError } from "./tool.js";

export type ReferenceApi = Pick<
    ApiReference,
    "lookup" | "namespaceOverview" | "namespaces" | "overview" | "search" | "symbolNames"
>;

export type ReferenceProvider = {
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
            `codegen is disabled for the project at ${root}, so there are no generated bindings to document. Remove \`codegen: false\` from gtkx.config.ts to use the API reference.`,
        );
    }
    const girPath = resolveGirPath(config.girPath);
    if (girPath.length === 0) {
        throw new Error(
            "No GIR search paths available. Install gobject-introspection (Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), or set `girPath` in gtkx.config.ts.",
        );
    }
    const libraries = resolveLibraries(config.libraries, girPath);
    const reference = ApiReference.load({ libraries, girPath, elementProps: config.elementProps ?? {} });
    const watched = [
        ...(configFile === undefined ? [] : [watchFile(resolve(root, configFile))]),
        ...reference.girFiles.map(watchFile),
    ];
    return { reference, watched };
};

export const createReferenceProvider = (resolveRoot: () => string): ReferenceProvider => {
    const cache = new Map<string, Promise<LoadedReference>>();
    const startLoad = (root: string): Promise<LoadedReference> => {
        const pending = loadReference(root);
        pending.catch(() => {
            if (cache.get(root) === pending) cache.delete(root);
        });
        cache.set(root, pending);
        return pending;
    };
    return {
        async get(): Promise<ReferenceApi> {
            const root = resolve(resolveRoot());
            const pending = cache.get(root);
            if (pending === undefined) return (await startLoad(root)).reference;
            const loaded = await pending;
            if (isFresh(loaded)) return loaded.reference;
            if (cache.get(root) === pending) cache.delete(root);
            const next = cache.get(root) ?? startLoad(root);
            return (await next).reference;
        },
    };
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
    "Qualified symbol name (`Gtk.Button`, `Gtk.Orientation`, `GLib.idleAdd`), JSX element name (`GtkButton`), or bare symbol name when unambiguous (`Button`).";

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

const getApiDocsShape = {
    symbol: z.string().describe(SYMBOL_DESCRIPTION),
    kind: SYMBOL_KIND.optional().describe("Disambiguate when several kinds share the symbol name."),
};

const formatCandidates = (candidates: ApiSymbol[]): string =>
    candidates.map((candidate) => `- ${candidate.namespace}.${candidate.name} (${candidate.kind})`).join("\n");

const listApiTool = (provider: ReferenceProvider): Tool =>
    defineTool({
        name: "gtkx_list_api",
        title: "List API reference",
        kind: "readOnly",
        description:
            "List the project's generated GTK bindings API (`@gtkx/gi` and `@gtkx/jsx`). Without a namespace, returns every namespace with symbol counts; with a namespace, lists all of its symbols grouped by kind.",
        inputSchema: listApiShape,
        handler: async ({ namespace }) => {
            const reference = await provider.get();
            if (namespace === undefined) return textContent(reference.overview());
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
            "Search the project's generated GTK bindings API by symbol name. Returns matching symbols with their namespace, kind, and a one-line summary; fetch full pages with `gtkx_get_api_docs`.",
        inputSchema: searchApiShape,
        handler: async ({ query, namespace, kind, limit }) => {
            const reference = await provider.get();
            const results = reference.search({
                query,
                ...(namespace === undefined ? {} : { namespace }),
                ...(kind === undefined ? {} : { kinds: [kind] }),
                ...(limit === undefined ? {} : { limit }),
            });
            if (results.length === 0) {
                return textContent(`No symbols matched "${query}". Try a shorter substring or \`gtkx_list_api\`.`);
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
            "Get the full reference page for one symbol of the project's generated GTK bindings: JSX elements (props, signals, methods) or `@gtkx/gi` classes, interfaces, records, enums, callbacks, aliases, functions, and constants.",
        inputSchema: getApiDocsShape,
        handler: async ({ symbol, kind }) => {
            const reference = await provider.get();
            const result = reference.lookup(symbol, kind);
            if (result.outcome === "notFound") {
                return textError(`No symbol named "${symbol}". Use \`gtkx_search_api\` to find the right name.`);
            }
            if (result.outcome === "ambiguous") {
                return textError(
                    `"${symbol}" matches several symbols. Pass a qualified name or a kind:\n${formatCandidates(result.candidates)}`,
                );
            }
            return textContent(result.markdown);
        },
    });

export const buildReferenceTools = (provider: ReferenceProvider): Tool[] => [
    listApiTool(provider),
    searchApiTool(provider),
    getApiDocsTool(provider),
];

const markdownResource = (uri: URL, text: string): ReadResourceResult => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
});

const variableValue = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

type ResourceServer = Pick<McpServer, "registerResource">;

const swallowLoadFailure =
    <T>(fallback: T) =>
    (): T =>
        fallback;

const namespaceCompleter =
    (provider: ReferenceProvider) =>
    (value: string): Promise<string[]> =>
        provider
            .get()
            .then((reference) =>
                reference
                    .namespaces()
                    .map((summary) => summary.name)
                    .filter((name) => name.toLowerCase().startsWith(value.toLowerCase())),
            )
            .catch(swallowLoadFailure<string[]>([]));

const resourceNotFound = (message: string): McpError => new McpError(ErrorCode.InvalidParams, message);

const registerIndexResource = (server: ResourceServer, provider: ReferenceProvider): void => {
    server.registerResource(
        "gtkx-api-reference",
        "gtkx://reference/index",
        {
            title: "GTKX API reference index",
            description: "Namespaces of the project's generated GTK bindings, with symbol and JSX element counts.",
            mimeType: "text/markdown",
        },
        async (uri) => markdownResource(uri, (await provider.get()).overview()),
    );
};

const registerNamespaceResource = (server: ResourceServer, provider: ReferenceProvider): void => {
    server.registerResource(
        "gtkx-api-namespace",
        new ResourceTemplate("gtkx://reference/{namespace}", {
            list: () =>
                provider
                    .get()
                    .then((reference) => ({
                        resources: reference.namespaces().map((summary) => ({
                            uri: `gtkx://reference/${summary.name}`,
                            name: `${summary.name} namespace reference`,
                            mimeType: "text/markdown",
                        })),
                    }))
                    .catch(swallowLoadFailure({ resources: [] })),
            complete: {
                namespace: namespaceCompleter(provider),
            },
        }),
        {
            title: "GTKX namespace reference",
            description: "All symbols of one namespace of the project's generated GTK bindings, grouped by kind.",
            mimeType: "text/markdown",
        },
        async (uri, variables) => {
            const namespace = variableValue(variables.namespace);
            const overview = (await provider.get()).namespaceOverview(namespace);
            if (overview === undefined) throw resourceNotFound(`Unknown namespace "${namespace}"`);
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
                symbol: (value, context) => {
                    const namespace = context?.arguments?.namespace;
                    if (namespace === undefined) return [];
                    return provider
                        .get()
                        .then((reference) =>
                            reference
                                .symbolNames(namespace)
                                .filter((name) => name.toLowerCase().startsWith(value.toLowerCase())),
                        )
                        .catch(swallowLoadFailure<string[]>([]));
                },
            },
        }),
        {
            title: "GTKX symbol reference",
            description:
                "Reference page for one symbol of the project's generated GTK bindings: a JSX element or a class, interface, record, enum, callback, alias, function, or constant.",
            mimeType: "text/markdown",
        },
        async (uri, variables) => {
            const namespace = variableValue(variables.namespace);
            const symbol = variableValue(variables.symbol);
            const reference = await provider.get();
            const result = reference.lookup(`${namespace}.${symbol}`);
            if (result.outcome === "page") return markdownResource(uri, result.markdown);
            if (result.outcome === "ambiguous") {
                throw resourceNotFound(
                    `"${namespace}.${symbol}" matches several symbols:\n${formatCandidates(result.candidates)}`,
                );
            }
            throw resourceNotFound(`No symbol named "${namespace}.${symbol}"`);
        },
    );
};

export const registerReferenceResources = (server: ResourceServer, provider: ReferenceProvider): void => {
    registerIndexResource(server, provider);
    registerNamespaceResource(server, provider);
    registerSymbolResource(server, provider);
};
