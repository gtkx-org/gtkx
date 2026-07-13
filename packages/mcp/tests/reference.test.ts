import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApiLookupResult, ApiReference, ApiSymbol } from "@gtkx/codegen";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiLoadMock, loadConfigMock, resolveGirPathMock, resolveLibrariesMock } = vi.hoisted(() => ({
    apiLoadMock: vi.fn(),
    loadConfigMock: vi.fn(),
    resolveGirPathMock: vi.fn(() => ["/usr/share/gir-1.0"]),
    resolveLibrariesMock: vi.fn(() => ["Gtk-4.0"]),
}));

vi.mock("@gtkx/codegen", () => ({
    ApiReference: { load: apiLoadMock },
    resolveGirPath: resolveGirPathMock,
    resolveLibraries: resolveLibrariesMock,
}));

vi.mock("@gtkx/config", () => ({
    loadConfig: loadConfigMock,
}));

import {
    buildReferenceTools,
    createReferenceProvider,
    type ReferenceApi,
    type ReferenceProvider,
    registerReferenceResources,
} from "../src/reference.js";
import type { Tool } from "../src/tool.js";

const buttonSymbol: ApiSymbol = { namespace: "Gtk", name: "Button", kind: "class", summary: "A button." };
const headerBarCandidates: ApiSymbol[] = [
    { namespace: "Gtk", name: "HeaderBar", kind: "class", summary: "A titlebar." },
    { namespace: "Adw", name: "HeaderBar", kind: "class", summary: "A title bar widget." },
];

type FakeReference = ReferenceApi & Pick<ApiReference, "girFiles">;

const fakeReference: FakeReference = {
    girFiles: [],
    overview: () => "ROOT OVERVIEW",
    namespaceOverview: (name) => (name === "Gtk" ? "GTK OVERVIEW" : undefined),
    namespaces: () => [
        { name: "Gtk", importPath: "@gtkx/gi/gtk", symbols: 2, elements: 1 },
        { name: "Adw", importPath: "@gtkx/gi/adw", symbols: 1, elements: 1 },
    ],
    symbolNames: (name) => (name === "Gtk" ? ["Button", "GtkButton", "Orientation"] : []),
    search: (options) => (options.query === "nothing" ? [] : [buttonSymbol]),
    lookup: (query): ApiLookupResult => {
        if (query === "Gtk.Button" || query === "Button") {
            return { outcome: "page", symbol: buttonSymbol, markdown: "BUTTON PAGE" };
        }
        if (query === "HeaderBar") return { outcome: "ambiguous", candidates: headerBarCandidates };
        return { outcome: "notFound" };
    },
};

const provider: ReferenceProvider = { get: async () => fakeReference };

const getTool = (name: string): Tool => {
    const tool = buildReferenceTools(provider).find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
};

const textOf = (result: { content: Array<{ type: string }> }): string => {
    const first = result.content[0];
    if (first === undefined || first.type !== "text") throw new Error("Expected text content");
    return (first as { type: "text"; text: string }).text;
};

describe("createReferenceProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads the reference once per project root and caches it", async () => {
        loadConfigMock.mockResolvedValue({ config: { elementProps: { GtkFixed: [] } } });
        apiLoadMock.mockReturnValue(fakeReference);
        const cached = createReferenceProvider(() => "/project");

        await cached.get();
        await cached.get();

        expect(loadConfigMock).toHaveBeenCalledExactlyOnceWith("/project");
        expect(resolveLibrariesMock).toHaveBeenCalledWith(undefined, ["/usr/share/gir-1.0"]);
        expect(apiLoadMock).toHaveBeenCalledExactlyOnceWith({
            libraries: ["Gtk-4.0"],
            girPath: ["/usr/share/gir-1.0"],
            elementProps: { GtkFixed: [] },
        });
    });

    it("loads separately when the resolved root changes", async () => {
        loadConfigMock.mockResolvedValue({ config: {} });
        apiLoadMock.mockReturnValue(fakeReference);
        const roots = ["/one", "/two"];
        const changing = createReferenceProvider(() => roots.shift() ?? "/two");

        await changing.get();
        await changing.get();

        expect(apiLoadMock).toHaveBeenCalledTimes(2);
        expect(loadConfigMock).toHaveBeenNthCalledWith(1, "/one");
        expect(loadConfigMock).toHaveBeenNthCalledWith(2, "/two");
    });

    it("rejects when codegen is disabled and retries after the backoff window", async () => {
        loadConfigMock.mockResolvedValueOnce({ config: { codegen: false } });
        loadConfigMock.mockResolvedValueOnce({ config: {} });
        apiLoadMock.mockReturnValue(fakeReference);
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
        try {
            const failing = createReferenceProvider(() => "/project");

            await expect(failing.get()).rejects.toThrow(/codegen is disabled/);
            await expect(failing.get()).rejects.toThrow(/codegen is disabled/);
            expect(loadConfigMock).toHaveBeenCalledTimes(1);

            nowSpy.mockReturnValue(10_000);
            await expect(failing.get()).resolves.toBe(fakeReference);
            expect(loadConfigMock).toHaveBeenCalledTimes(2);
        } finally {
            nowSpy.mockRestore();
        }
    });

    it("rejects when no GIR search paths are available", async () => {
        loadConfigMock.mockResolvedValue({ config: {} });
        resolveGirPathMock.mockReturnValueOnce([]);
        const failing = createReferenceProvider(() => "/project");

        await expect(failing.get()).rejects.toThrow(/No GIR search paths available/);
    });

    it("reloads when a watched GIR file changes, throttling freshness checks", async () => {
        loadConfigMock.mockResolvedValue({ config: {} });
        const dir = mkdtempSync(join(tmpdir(), "gtkx-reference-"));
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
        try {
            const girFile = join(dir, "Gtk-4.0.gir");
            writeFileSync(girFile, "before");
            apiLoadMock.mockReturnValue({ ...fakeReference, girFiles: [girFile] });
            const watching = createReferenceProvider(() => "/project");

            await watching.get();
            writeFileSync(girFile, "after-with-different-size");
            await watching.get();
            expect(apiLoadMock).toHaveBeenCalledTimes(1);

            nowSpy.mockReturnValue(10_000);
            await watching.get();
            expect(apiLoadMock).toHaveBeenCalledTimes(2);
        } finally {
            nowSpy.mockRestore();
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("gtkx_list_api", () => {
    it("returns the root overview without a namespace", async () => {
        const result = await getTool("gtkx_list_api").handler({} as never);
        expect(textOf(result)).toBe("ROOT OVERVIEW");
    });

    it("returns a namespace overview", async () => {
        const result = await getTool("gtkx_list_api").handler({ namespace: "Gtk" } as never);
        expect(textOf(result)).toBe("GTK OVERVIEW");
    });

    it("errors on an unknown namespace, listing the known ones", async () => {
        const result = await getTool("gtkx_list_api").handler({ namespace: "Nope" } as never);
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain('Unknown namespace "Nope"');
        expect(textOf(result)).toContain("Gtk, Adw");
    });
});

describe("gtkx_search_api", () => {
    it("returns matches as JSON", async () => {
        const result = await getTool("gtkx_search_api").handler({ query: "button" } as never);
        expect(JSON.parse(textOf(result))).toEqual([buttonSymbol]);
    });

    it("forwards namespace, kind, and limit filters", async () => {
        const search = vi.fn(() => [buttonSymbol]);
        const filtering: ReferenceProvider = { get: async () => ({ ...fakeReference, search }) };
        const tool = buildReferenceTools(filtering).find((candidate) => candidate.name === "gtkx_search_api");
        if (!tool) throw new Error("Tool not found");

        await tool.handler({ query: "button", namespace: "Gtk", kind: "class", limit: 5 } as never);

        expect(search).toHaveBeenCalledWith({ query: "button", namespace: "Gtk", kinds: ["class"], limit: 5 });
    });

    it("reports when nothing matched", async () => {
        const result = await getTool("gtkx_search_api").handler({ query: "nothing" } as never);
        expect(result.isError).toBeUndefined();
        expect(textOf(result)).toContain('No symbols matched "nothing"');
    });
});

describe("gtkx_get_api_docs", () => {
    it("returns the rendered page", async () => {
        const result = await getTool("gtkx_get_api_docs").handler({ symbol: "Gtk.Button" } as never);
        expect(textOf(result)).toBe("BUTTON PAGE");
    });

    it("errors with candidates when the symbol is ambiguous", async () => {
        const result = await getTool("gtkx_get_api_docs").handler({ symbol: "HeaderBar" } as never);
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain("- Gtk.HeaderBar (class)");
        expect(textOf(result)).toContain("- Adw.HeaderBar (class)");
    });

    it("errors with a search hint when the symbol is unknown", async () => {
        const result = await getTool("gtkx_get_api_docs").handler({ symbol: "Missing" } as never);
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain("gtkx_search_api");
    });
});

type ReadCallback = (uri: URL, variables?: Record<string, string | string[]>) => Promise<ReadResourceResult>;

type RegisteredResource = {
    name: string;
    uriOrTemplate: string | ResourceTemplate;
    config: { mimeType?: string };
    read: ReadCallback;
};

const registerAll = (): RegisteredResource[] => {
    const registered: RegisteredResource[] = [];
    const server = {
        registerResource: ((
            name: string,
            uriOrTemplate: string | ResourceTemplate,
            config: { mimeType?: string },
            read: ReadCallback,
        ) => {
            registered.push({ name, uriOrTemplate, config, read });
        }) as never,
    };
    registerReferenceResources(server, provider);
    return registered;
};

const getResource = (name: string): RegisteredResource => {
    const resource = registerAll().find((candidate) => candidate.name === name);
    if (!resource) throw new Error(`Resource not found: ${name}`);
    return resource;
};

const getTemplate = (resource: RegisteredResource): ResourceTemplate => {
    if (!(resource.uriOrTemplate instanceof ResourceTemplate)) throw new Error("Expected a ResourceTemplate");
    return resource.uriOrTemplate;
};

const getCompleter = (template: ResourceTemplate, variable: string) => {
    const completer = template.completeCallback(variable);
    if (!completer) throw new Error(`No completer for ${variable}`);
    return completer;
};

const resourceText = (result: ReadResourceResult): string => {
    const first = result.contents[0];
    if (first === undefined || !("text" in first)) throw new Error("Expected text contents");
    return String(first.text);
};

describe("registerReferenceResources", () => {
    it("serves the index resource at a fixed URI", async () => {
        const resource = getResource("gtkx-api-reference");
        expect(resource.uriOrTemplate).toBe("gtkx://reference/index");
        expect(resource.config.mimeType).toBe("text/markdown");
        const result = await resource.read(new URL("gtkx://reference/index"));
        expect(resourceText(result)).toBe("ROOT OVERVIEW");
        expect(result.contents[0]?.uri).toBe("gtkx://reference/index");
    });

    it("serves namespace overviews, lists them, and completes namespace names", async () => {
        const resource = getResource("gtkx-api-namespace");
        const template = getTemplate(resource);
        expect(template.uriTemplate.toString()).toBe("gtkx://reference/{namespace}");

        const result = await resource.read(new URL("gtkx://reference/Gtk"), { namespace: "Gtk" });
        expect(resourceText(result)).toBe("GTK OVERVIEW");
        await expect(resource.read(new URL("gtkx://reference/Nope"), { namespace: "Nope" })).rejects.toThrow(
            /Unknown namespace/,
        );

        const listCallback = template.listCallback;
        if (!listCallback) throw new Error("Expected a list callback");
        const listed = await listCallback({} as never);
        expect(listed.resources.map((entry) => entry.uri)).toEqual(["gtkx://reference/Gtk", "gtkx://reference/Adw"]);

        await expect(getCompleter(template, "namespace")("g")).resolves.toEqual(["Gtk"]);
    });

    it("degrades gracefully when the reference cannot load", async () => {
        const failing: ReferenceProvider = {
            get: async () => {
                throw new Error("codegen is disabled");
            },
        };
        const registered: RegisteredResource[] = [];
        const server = {
            registerResource: ((
                name: string,
                uriOrTemplate: string | ResourceTemplate,
                config: { mimeType?: string },
                read: ReadCallback,
            ) => {
                registered.push({ name, uriOrTemplate, config, read });
            }) as never,
        };
        registerReferenceResources(server, failing);

        const namespaceResource = registered.find((resource) => resource.name === "gtkx-api-namespace");
        if (!namespaceResource) throw new Error("Resource not found");
        const template = getTemplate(namespaceResource);
        const listCallback = template.listCallback;
        if (!listCallback) throw new Error("Expected a list callback");
        await expect(listCallback({} as never)).resolves.toEqual({ resources: [] });
        await expect(getCompleter(template, "namespace")("g")).resolves.toEqual([]);
        await expect(namespaceResource.read(new URL("gtkx://reference/Gtk"), { namespace: "Gtk" })).rejects.toThrow(
            /codegen is disabled/,
        );
    });

    it("serves symbol pages and completes namespaces and symbols", async () => {
        const resource = getResource("gtkx-api-symbol");
        const template = getTemplate(resource);
        expect(template.uriTemplate.toString()).toBe("gtkx://reference/{namespace}/{symbol}");

        const result = await resource.read(new URL("gtkx://reference/Gtk/Button"), {
            namespace: "Gtk",
            symbol: "Button",
        });
        expect(resourceText(result)).toBe("BUTTON PAGE");
        await expect(
            resource.read(new URL("gtkx://reference/Gtk/Missing"), { namespace: "Gtk", symbol: "Missing" }),
        ).rejects.toThrow(/No symbol named/);

        await expect(getCompleter(template, "namespace")("a")).resolves.toEqual(["Adw"]);
        await expect(getCompleter(template, "symbol")("gtk", { arguments: { namespace: "Gtk" } })).resolves.toEqual([
            "GtkButton",
        ]);
        expect(await getCompleter(template, "symbol")("gtk")).toEqual([]);
    });
});
