import type { ApiLookupResult, ApiReference, ApiSymbol } from "@gtkx/codegen";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tool } from "../src/tool.js";
import {
    buildReferenceTools,
    createReferenceProvider,
    type ReferenceApi,
    type ReferenceProvider,
    registerReferenceResources,
    type ResolvedProject,
} from "../src/reference.js";

type FakeReference = ReferenceApi & Pick<ApiReference, "girFiles">;
type ReadCallback = (uri: URL, variables?: Record<string, string | string[]>) => Promise<ReadResourceResult>;

type RegisteredResource = {
    name: string;
    uriOrTemplate: string | ResourceTemplate;
    config: { mimeType?: string };
    read: ReadCallback;
};

type ProjectDirs = {
    explicit: string;
    app: string;
    workingDirectory: string;
    nested: string;
    elsewhere: string;
};

type ScopingCase = {
    name: string;
    workingDirectory: keyof ProjectDirs;
    appRoot?: keyof ProjectDirs;
    projectRoot?: keyof ProjectDirs;
    expectedRoot: keyof ProjectDirs;
    expectedSource: "argument" | "workingDirectory" | "app";
};

const { loadApiReferenceMock, loadConfigMock, resolveGirPathMock, resolveLibrariesMock } = vi.hoisted(() => ({
    loadApiReferenceMock: vi.fn(),
    loadConfigMock: vi.fn(),
    resolveGirPathMock: vi.fn(() => ["/usr/share/gir-1.0"]),
    resolveLibrariesMock: vi.fn(() => ["Gtk-4.0"]),
}));

const buttonSymbol: ApiSymbol = { namespace: "Gtk", name: "Button", kind: "class", summary: "A button." };

const headerBarCandidates: ApiSymbol[] = [
    { namespace: "Gtk", name: "HeaderBar", kind: "class", summary: "A titlebar." },
    { namespace: "Adw", name: "HeaderBar", kind: "class", summary: "A title bar widget." },
];

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
    lookup: (query): ApiLookupResult => lookupFake(query),
};

const provider: ReferenceProvider = {
    get: (projectRoot) => Promise.resolve({ reference: fakeReference, ...resolveFake(projectRoot) }),
    load: (project) => Promise.resolve({ reference: fakeReference, ...project }),
    resolve: (projectRoot) => resolveFake(projectRoot),
};

const SCOPING_CASES: ScopingCase[] = [
    {
        name: "prefers an explicit project root over a registered app",
        workingDirectory: "workingDirectory",
        appRoot: "app",
        projectRoot: "explicit",
        expectedRoot: "explicit",
        expectedSource: "argument",
    },
    {
        name: "prefers the project containing the working directory over a registered app",
        workingDirectory: "nested",
        appRoot: "app",
        expectedRoot: "workingDirectory",
        expectedSource: "workingDirectory",
    },
    {
        name: "falls back to a registered app when the working directory is not a project",
        workingDirectory: "elsewhere",
        appRoot: "app",
        expectedRoot: "app",
        expectedSource: "app",
    },
    {
        name: "resolves from the working directory with no app and no explicit root",
        workingDirectory: "nested",
        expectedRoot: "workingDirectory",
        expectedSource: "workingDirectory",
    },
    {
        name: "resolves the working directory itself when no project encloses it",
        workingDirectory: "elsewhere",
        expectedRoot: "elsewhere",
        expectedSource: "workingDirectory",
    },
];

const resolveFake = (projectRoot?: string): { root: string; source: "app" | "argument" } => ({
    root: projectRoot ?? "/apps/hello-world",
    source: projectRoot === undefined ? "app" : "argument",
});

function lookupFake(query: string): ApiLookupResult {
    if (query === "Gtk.Button" || query === "Button") {
        return { outcome: "page", symbol: buttonSymbol, markdown: "BUTTON PAGE" };
    }

    if (query === "HeaderBar") {
        return { outcome: "ambiguous", candidates: headerBarCandidates };
    }

    return { outcome: "notFound" };
}

function getTool(name: string): Tool {
    const tool = buildReferenceTools(provider).find((candidate) => candidate.name === name);

    if (!tool) {
        throw new Error(`Tool not found: ${name}`);
    }

    return tool;
}

function getText(result: { content: { type: string }[] }): string {
    const first = result.content[0];

    if (first?.type !== "text") {
        throw new Error("Expected text content");
    }

    return (first as { type: "text"; text: string }).text;
}

function getNote(result: { content: { type: string }[] }): string {
    const last = result.content.at(-1);

    if (last?.type !== "text") {
        throw new Error("Expected text content");
    }

    return (last as { type: "text"; text: string }).text;
}

function stubLoadedReference(reference: FakeReference = fakeReference): void {
    loadConfigMock.mockImplementation((root: string) =>
        Promise.resolve({ config: {}, configFile: "gtkx.config.ts", root }),
    );

    loadApiReferenceMock.mockReturnValue(reference);
}

function makeProjectDirs(base: string): ProjectDirs {
    const dirs: ProjectDirs = {
        explicit: join(base, "explicit"),
        app: join(base, "app"),
        workingDirectory: join(base, "working"),
        nested: join(base, "working", "src", "nested"),
        elsewhere: join(base, "elsewhere"),
    };

    mkdirSync(dirs.nested, { recursive: true });
    mkdirSync(dirs.elsewhere, { recursive: true });

    for (const root of [dirs.explicit, dirs.app, dirs.workingDirectory]) {
        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, "gtkx.config.ts"), "export default {};");
    }

    return dirs;
}

async function withProjectDirs(run: (dirs: ProjectDirs) => Promise<void>): Promise<void> {
    const base = mkdtempSync(join(tmpdir(), "gtkx-projects-"));

    try {
        stubLoadedReference();
        await run(makeProjectDirs(base));
    } finally {
        rmSync(base, { recursive: true, force: true });
    }
}

function makeProvider(getWorkingDirectory: () => string, appRoot?: string): ReferenceProvider {
    return createReferenceProvider({ getAppRoot: () => appRoot, getWorkingDirectory });
}

function dirFor(dirs: ProjectDirs, key: keyof ProjectDirs | undefined): string | undefined {
    return key === undefined ? undefined : dirs[key];
}

async function missingSymbolError(): Promise<CallToolResult> {
    const result = await getTool("gtkx_get_api_docs").handler({ symbol: "Missing" });
    expect(result.isError).toBe(true);

    return result;
}

async function withFrozenClock(run: (setNow: (now: number) => void) => Promise<void>): Promise<void> {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);

    try {
        await run((now) => {
            nowSpy.mockReturnValue(now);
        });
    } finally {
        nowSpy.mockRestore();
    }
}

async function withGirFile(run: (girFile: string, setNow: (now: number) => void) => Promise<void>): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), "gtkx-reference-"));

    try {
        await withFrozenClock((setNow) => run(join(dir, "Gtk-4.0.gir"), setNow));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function registerAllWith(source: ReferenceProvider): RegisteredResource[] {
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

    registerReferenceResources(server, source);

    return registered;
}

function findResource(registered: RegisteredResource[], name: string): RegisteredResource {
    const resource = registered.find((candidate) => candidate.name === name);

    if (!resource) {
        throw new Error(`Resource not found: ${name}`);
    }

    return resource;
}

function getResource(name: string): RegisteredResource {
    return findResource(registerAllWith(provider), name);
}

function getListCallback(template: ResourceTemplate) {
    const listCallback = template.listCallback;

    if (!listCallback) {
        throw new Error("Expected a list callback");
    }

    return listCallback;
}

function getTemplate(resource: RegisteredResource): ResourceTemplate {
    if (!(resource.uriOrTemplate instanceof ResourceTemplate)) {
        throw new TypeError("Expected a ResourceTemplate");
    }

    return resource.uriOrTemplate;
}

function getCompleter(template: ResourceTemplate, variable: string) {
    const completer = template.completeCallback(variable);

    if (!completer) {
        throw new Error(`No completer for ${variable}`);
    }

    return completer;
}

function resourceText(result: ReadResourceResult): string {
    const first = result.contents[0];

    if (first === undefined || !("text" in first)) {
        throw new Error("Expected text contents");
    }

    return first.text;
}

vi.mock("@gtkx/codegen", () => ({
    loadApiReference: loadApiReferenceMock,
    resolveGirPath: resolveGirPathMock,
    resolveLibraries: resolveLibrariesMock,
}));

vi.mock("@gtkx/config", () => ({
    loadConfig: loadConfigMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("createReferenceProvider — project scoping", () => {
    it.each(SCOPING_CASES)("$name", async (scoping) => {
        await withProjectDirs(async (dirs) => {
            const expectedRoot = dirs[scoping.expectedRoot];
            const scoped = makeProvider(() => dirs[scoping.workingDirectory], dirFor(dirs, scoping.appRoot));
            const resolved = await scoped.get(dirFor(dirs, scoping.projectRoot));
            expect(loadConfigMock).toHaveBeenCalledExactlyOnceWith(expectedRoot);
            expect(resolved.root).toBe(expectedRoot);
            expect(resolved.source).toBe(scoping.expectedSource);
        });
    });
});

describe("createReferenceProvider — root discovery", () => {
    it("reads the project root the configuration was found in", async () => {
        await withProjectDirs(async (dirs) => {
            loadConfigMock.mockResolvedValueOnce({
                config: {},
                configFile: "gtkx.config.ts",
                root: dirs.workingDirectory,
            });

            await expect(makeProvider(() => dirs.elsewhere).get()).resolves.toMatchObject({
                root: dirs.workingDirectory,
            });
        });
    });
});

describe("createReferenceProvider — caching", () => {
    it("loads the reference once per project root and caches it", async () => {
        stubLoadedReference();
        const cached = makeProvider(() => "/project");
        await cached.get();
        await cached.get();
        expect(loadConfigMock).toHaveBeenCalledExactlyOnceWith("/project");
        expect(resolveLibrariesMock).toHaveBeenCalledWith(undefined, ["/usr/share/gir-1.0"]);

        expect(loadApiReferenceMock).toHaveBeenCalledExactlyOnceWith({
            libraries: ["Gtk-4.0"],
            girPath: ["/usr/share/gir-1.0"],
        });
    });

    it("loads separately when the resolved root changes", async () => {
        stubLoadedReference();
        const roots = ["/one", "/two"];
        const changing = makeProvider(() => roots.shift() ?? "/two");
        await changing.get();
        await changing.get();
        expect(loadApiReferenceMock).toHaveBeenCalledTimes(2);
        expect(loadConfigMock).toHaveBeenNthCalledWith(1, "/one");
        expect(loadConfigMock).toHaveBeenNthCalledWith(2, "/two");
    });
});

describe("createReferenceProvider — failures and reloads", () => {
    it("rejects when codegen is disabled and retries after the backoff window", async () => {
        loadConfigMock.mockResolvedValueOnce({
            config: { codegen: false },
            configFile: "gtkx.config.ts",
            root: "/project",
        });

        loadConfigMock.mockResolvedValueOnce({ config: {}, configFile: "gtkx.config.ts", root: "/project" });
        loadApiReferenceMock.mockReturnValue(fakeReference);

        await withFrozenClock(async (setNow) => {
            const failing = makeProvider(() => "/project");
            await expect(failing.get()).rejects.toThrow(/codegen is disabled/);
            await expect(failing.get()).rejects.toThrow(/codegen is disabled/);
            expect(loadConfigMock).toHaveBeenCalledTimes(1);
            setNow(10_000);
            await expect(failing.get()).resolves.toMatchObject({ reference: fakeReference });
            expect(loadConfigMock).toHaveBeenCalledTimes(2);
        });
    });

    it("rejects when no GIR search paths are available", async () => {
        loadConfigMock.mockResolvedValue({ config: {}, configFile: "gtkx.config.ts", root: "/project" });
        resolveGirPathMock.mockReturnValueOnce([]);
        const failing = makeProvider(() => "/project");
        await expect(failing.get()).rejects.toThrow(/No GIR search paths available/);
    });

    it("reloads when a watched GIR file changes, throttling freshness checks", async () => {
        await withGirFile(async (girFile, setNow) => {
            writeFileSync(girFile, "before");
            stubLoadedReference({ ...fakeReference, girFiles: [girFile] });
            const watching = makeProvider(() => "/project");
            await watching.get();
            writeFileSync(girFile, "after-with-different-size");
            await watching.get();
            expect(loadApiReferenceMock).toHaveBeenCalledTimes(1);
            setNow(10_000);
            await watching.get();
            expect(loadApiReferenceMock).toHaveBeenCalledTimes(2);
        });
    });
});

describe("gtkx_list_api", () => {
    it("returns the root overview without a namespace", async () => {
        const result = await getTool("gtkx_list_api").handler({});
        expect(getText(result)).toBe("ROOT OVERVIEW");
    });

    it("returns a namespace overview", async () => {
        const result = await getTool("gtkx_list_api").handler({ namespace: "Gtk" });
        expect(getText(result)).toBe("GTK OVERVIEW");
    });

    it("errors on an unknown namespace, listing the known ones", async () => {
        const result = await getTool("gtkx_list_api").handler({ namespace: "Nope" });
        expect(result.isError).toBe(true);
        expect(getText(result)).toContain('Unknown namespace "Nope"');
        expect(getText(result)).toContain("Gtk, Adw");
    });
});

describe("gtkx_search_api", () => {
    it("returns matches as JSON", async () => {
        const result = await getTool("gtkx_search_api").handler({ query: "button" });
        expect(JSON.parse(getText(result))).toEqual([buttonSymbol]);
    });

    it("forwards namespace, kind, and limit filters", async () => {
        const search = vi.fn(() => [buttonSymbol]);

        const scoped = {
            reference: { ...fakeReference, search },
            root: "/apps/hello-world",
            source: "app",
        } as const;

        const filtering: ReferenceProvider = {
            get: () => Promise.resolve(scoped),
            load: () => Promise.resolve(scoped),
            resolve: () => ({ root: "/apps/hello-world", source: "app" }),
        };

        const tool = buildReferenceTools(filtering).find((candidate) => candidate.name === "gtkx_search_api");

        if (!tool) {
            throw new Error("Tool not found");
        }

        await tool.handler({ query: "button", namespace: "Gtk", kind: "class", limit: 5 });
        expect(search).toHaveBeenCalledWith({ query: "button", namespace: "Gtk", kinds: ["class"], limit: 5 });
    });

    it("reports when nothing matched", async () => {
        const result = await getTool("gtkx_search_api").handler({ query: "nothing" });
        expect(result.isError).toBeUndefined();
        expect(getText(result)).toContain('No symbols matched "nothing"');
    });
});

describe("gtkx_get_api_docs", () => {
    it("returns the rendered page", async () => {
        const result = await getTool("gtkx_get_api_docs").handler({ symbol: "Gtk.Button" });
        expect(getText(result)).toBe("BUTTON PAGE");
    });

    it("errors with candidates when the symbol is ambiguous", async () => {
        const result = await getTool("gtkx_get_api_docs").handler({ symbol: "HeaderBar" });
        expect(result.isError).toBe(true);
        expect(getText(result)).toContain("- Gtk.HeaderBar (class)");
        expect(getText(result)).toContain("- Adw.HeaderBar (class)");
    });

    it("errors with a search hint when the symbol is unknown", async () => {
        expect(getText(await missingSymbolError())).toContain("gtkx_search_api");
    });
});

describe("reference tools — project scoping", () => {
    it("names the project every successful answer is scoped to", async () => {
        const listed = await getTool("gtkx_list_api").handler({});
        const searched = await getTool("gtkx_search_api").handler({ query: "button" });
        const documented = await getTool("gtkx_get_api_docs").handler({ symbol: "Gtk.Button" });
        expect(listed.isError).toBeUndefined();
        expect(getText(documented)).toBe("BUTTON PAGE");

        for (const result of [listed, searched, documented]) {
            expect(getNote(result)).toContain("Project: /apps/hello-world");
            expect(getNote(result)).toContain("connected app");
        }
    });

    it("keeps the payload as the first content block", async () => {
        const searched = await getTool("gtkx_search_api").handler({ query: "button" });
        expect(JSON.parse(getText(searched))).toEqual([buttonSymbol]);
        expect(searched.content).toHaveLength(2);
    });

    it("forwards an explicit project root and names it in the answer", async () => {
        const load = vi.fn((project: ResolvedProject) => provider.load(project));

        const forwarding: ReferenceProvider = {
            get: (projectRoot) => provider.get(projectRoot),
            load,
            resolve: (projectRoot) => resolveFake(projectRoot),
        };

        const tools = buildReferenceTools(forwarding);

        for (const tool of tools) {
            const result = await tool.handler({ projectRoot: "/projects/tablestar", query: "b", symbol: "Gtk.Button" });
            expect(getNote(result)).toBe("Project: /projects/tablestar (requested with `projectRoot`)");
        }

        expect(load.mock.calls.map(([project]) => project.root)).toEqual(tools.map(() => "/projects/tablestar"));
    });

    it("names the project on errors as well", async () => {
        expect(getNote(await missingSymbolError())).toContain("Project: /apps/hello-world");
    });
});

describe("registerReferenceResources — index and namespaces", () => {
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

        const listed = await getListCallback(template)({} as never);
        expect(listed.resources.map((entry) => entry.uri)).toEqual(["gtkx://reference/Gtk", "gtkx://reference/Adw"]);
        await expect(getCompleter(template, "namespace")("g")).resolves.toEqual(["Gtk"]);
    });

    it("degrades gracefully when the reference cannot load", async () => {
        const failing: ReferenceProvider = {
            get: () => Promise.reject(new Error("codegen is disabled")),
            load: () => Promise.reject(new Error("codegen is disabled")),
            resolve: (projectRoot) => resolveFake(projectRoot),
        };

        const namespaceResource = findResource(registerAllWith(failing), "gtkx-api-namespace");
        const template = getTemplate(namespaceResource);
        await expect(getListCallback(template)({} as never)).resolves.toEqual({ resources: [] });
        await expect(getCompleter(template, "namespace")("g")).resolves.toEqual([]);

        await expect(namespaceResource.read(new URL("gtkx://reference/Gtk"), { namespace: "Gtk" })).rejects.toThrow(
            /codegen is disabled/,
        );
    });
});

describe("registerReferenceResources — symbols", () => {
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
