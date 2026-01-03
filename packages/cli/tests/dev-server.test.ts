import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEvents = new EventEmitter();

const mockModule = {
    default: vi.fn(() => null),
    appId: "org.test.app",
    appFlags: 0,
};

const mockModuleGraph = {
    idToModuleMap: new Map([
        ["test-module", { id: "test-module", importers: new Set() }],
        ["test-module-2", { id: "test-module-2", importers: new Set() }],
    ]),
    invalidateModule: vi.fn(),
    getModuleById: vi.fn(),
};

const mockWatcher = {
    on: vi.fn(),
};

const mockViteServer = {
    ssrLoadModule: vi.fn().mockResolvedValue(mockModule),
    moduleGraph: mockModuleGraph,
    watcher: mockWatcher,
    close: vi.fn(),
};

vi.mock("vite", () => ({
    createServer: vi.fn().mockResolvedValue(mockViteServer),
}));

vi.mock("../src/refresh-runtime.js", () => ({
    initializeRefreshRuntime: vi.fn(),
    isReactRefreshBoundary: vi.fn().mockReturnValue(false),
    performRefresh: vi.fn(),
}));

vi.mock("../src/vite-plugin-swc-ssr-refresh.js", () => ({
    swcSsrRefresh: vi.fn(() => ({ name: "gtkx:swc-ssr-refresh" })),
}));

vi.mock("../src/vite-plugin-gtkx-refresh.js", () => ({
    gtkxRefresh: vi.fn(() => ({ name: "gtkx:refresh" })),
}));

vi.mock("@gtkx/react", () => ({
    update: vi.fn(),
    setHotReloading: vi.fn(),
}));

vi.mock("@gtkx/ffi", () => ({
    events: mockEvents,
}));

describe("createDevServer", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mockModuleGraph.getModuleById.mockReset();
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
        mockEvents.removeAllListeners("stop");
    });

    it("creates a vite server with correct configuration", async () => {
        const { createServer } = await import("vite");
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        expect(createServer).toHaveBeenCalledWith(
            expect.objectContaining({
                appType: "custom",
                server: expect.objectContaining({
                    middlewareMode: true,
                }),
                optimizeDeps: expect.objectContaining({
                    noDiscovery: true,
                    include: [],
                }),
                ssr: expect.objectContaining({
                    external: true,
                }),
            }),
        );
    });

    it("returns the vite server instance", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        const server = await createDevServer({
            entry: "/path/to/app.tsx",
        });

        expect(server).toBe(mockViteServer);
    });

    it("accepts custom vite configuration", async () => {
        const { createServer } = await import("vite");
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
            vite: {
                root: "/custom/root",
            },
        });

        expect(createServer).toHaveBeenCalledWith(
            expect.objectContaining({
                root: "/custom/root",
            }),
        );
    });

    it("registers file change watcher", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        expect(mockWatcher.on).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("registers stop event handler", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        expect(mockEvents.listenerCount("stop")).toBeGreaterThan(0);
    });

    it("loads entry module via ssrLoadModule", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        const server = await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const loadedModule = await server.ssrLoadModule("/path/to/app.tsx");
        expect(loadedModule).toEqual(mockModule);
    });

    it("provides module with default export", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        const server = await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const loadedModule = await server.ssrLoadModule("/path/to/app.tsx");
        expect(typeof loadedModule.default).toBe("function");
    });

    it("provides module with optional appId export", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        const server = await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const loadedModule = await server.ssrLoadModule("/path/to/app.tsx");
        expect(loadedModule.appId).toBe("org.test.app");
    });

    it("provides module with optional appFlags export", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        const server = await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const loadedModule = await server.ssrLoadModule("/path/to/app.tsx");
        expect(loadedModule.appFlags).toBe(0);
    });

    it("ignores file change when file is not in module graph", async () => {
        mockModuleGraph.getModuleById.mockReturnValue(undefined);

        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === "change")?.[1];
        expect(changeHandler).toBeDefined();

        await changeHandler("/path/to/unused-file.tsx");

        expect(mockModuleGraph.invalidateModule).not.toHaveBeenCalled();
    });

    it("invalidates all modules on file change when not a refresh boundary", async () => {
        const changedModule = { id: "/path/to/changed-file.tsx", importers: new Set() };
        mockModuleGraph.getModuleById.mockReturnValue(changedModule);

        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === "change")?.[1];
        expect(changeHandler).toBeDefined();

        await changeHandler("/path/to/changed-file.tsx");

        expect(mockModuleGraph.invalidateModule).toHaveBeenCalledTimes(3);
    });

    it("attempts selective invalidation when module is in graph", async () => {
        const changedModule = { id: "/path/to/changed-file.tsx", importers: new Set() };
        mockModuleGraph.getModuleById.mockReturnValue(changedModule);

        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === "change")?.[1];

        await changeHandler("/path/to/changed-file.tsx");

        expect(mockModuleGraph.getModuleById).toHaveBeenCalledWith("/path/to/changed-file.tsx");
    });

    it("completes full reload on file change when not a refresh boundary", async () => {
        const changedModule = { id: "/path/to/changed-file.tsx", importers: new Set() };
        mockModuleGraph.getModuleById.mockReturnValue(changedModule);

        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === "change")?.[1];
        await changeHandler("/path/to/changed-file.tsx");

        expect(consoleLogSpy).toHaveBeenCalledWith("[gtkx] Full reload complete");
    });

    it("closes server on stop event", async () => {
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        mockEvents.emit("stop");

        expect(mockViteServer.close).toHaveBeenCalled();
    });

    it("includes swc-ssr-refresh plugin", async () => {
        const { createServer } = await import("vite");
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const config = vi.mocked(createServer).mock.calls[0]?.[0];
        expect(config).toBeDefined();
        const plugins = config?.plugins?.flat() as Array<{ name: string }>;
        expect(plugins.some((p) => p.name === "gtkx:swc-ssr-refresh")).toBe(true);
    });

    it("includes gtkx:refresh plugin", async () => {
        const { createServer } = await import("vite");
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const config = vi.mocked(createServer).mock.calls[0]?.[0];
        expect(config).toBeDefined();
        const plugins = config?.plugins?.flat() as Array<{ name: string }>;
        expect(plugins.some((p) => p.name === "gtkx:refresh")).toBe(true);
    });

    it("includes gtkx:remove-react-dom-optimized plugin", async () => {
        const { createServer } = await import("vite");
        const { createDevServer } = await import("../src/dev-server.js");

        await createDevServer({
            entry: "/path/to/app.tsx",
        });

        const config = vi.mocked(createServer).mock.calls[0]?.[0];
        expect(config).toBeDefined();
        const plugins = config?.plugins?.flat() as Array<{ name: string }>;
        expect(plugins.some((p) => p.name === "gtkx:remove-react-dom-optimized")).toBe(true);
    });

    describe("error handling", () => {
        it("handles module load errors during hot reload gracefully", async () => {
            const changedModule = { id: "/path/to/changed-file.tsx", importers: new Set() };
            mockModuleGraph.getModuleById.mockReturnValue(changedModule);
            mockViteServer.ssrLoadModule.mockRejectedValueOnce(new Error("Module load failed"));

            const { createDevServer } = await import("../src/dev-server.js");

            await createDevServer({
                entry: "/path/to/app.tsx",
            });

            const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === "change")?.[1];
            await changeHandler("/path/to/changed-file.tsx");

            expect(consoleErrorSpy).toHaveBeenCalledWith("[gtkx] Hot reload failed:", expect.any(Error));
        });

        it("handles non-function default export during hot reload", async () => {
            const changedModule = { id: "/path/to/changed-file.tsx", importers: new Set() };
            mockModuleGraph.getModuleById.mockReturnValue(changedModule);
            mockViteServer.ssrLoadModule
                .mockResolvedValueOnce({ default: vi.fn() })
                .mockResolvedValueOnce({ default: "not-a-function" });

            const { createDevServer } = await import("../src/dev-server.js");

            await createDevServer({
                entry: "/path/to/app.tsx",
            });

            const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === "change")?.[1];
            await changeHandler("/path/to/changed-file.tsx");

            expect(consoleErrorSpy).toHaveBeenCalledWith("[gtkx] Entry file must export a default function component");
        });
    });
});
