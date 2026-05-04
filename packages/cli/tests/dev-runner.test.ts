import { EventEmitter } from "node:events";
import type { ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerMock, eventsOn, gioGetDefault, startMcpClientMock, stopMcpClientMock } = vi.hoisted(() => ({
    createServerMock: vi.fn(),
    eventsOn: vi.fn(),
    gioGetDefault: vi.fn(() => null as { applicationId?: string } | null),
    startMcpClientMock: vi.fn(async () => undefined),
    stopMcpClientMock: vi.fn(),
}));

vi.mock("vite", () => ({
    createServer: createServerMock,
}));

vi.mock("@gtkx/ffi", () => ({
    events: { on: eventsOn },
}));

vi.mock("@gtkx/ffi/gio", () => ({
    Application: { getDefault: gioGetDefault },
}));

vi.mock("../src/mcp-client.js", () => ({
    startMcpClient: startMcpClientMock,
    stopMcpClient: stopMcpClientMock,
}));

vi.mock("../src/refresh-runtime.js", () => ({
    isReactRefreshBoundary: (mod: Record<string, unknown>) => mod.__isBoundary === true,
    performRefresh: vi.fn(),
}));

vi.mock("../src/vite-plugin-gtkx-assets.js", () => ({ gtkxAssets: () => ({ name: "gtkx:assets" }) }));
vi.mock("../src/vite-plugin-gtkx-gsettings.js", () => ({ gtkxGSettings: () => ({ name: "gtkx:gsettings" }) }));
vi.mock("../src/vite-plugin-gtkx-refresh.js", () => ({ gtkxRefresh: () => ({ name: "gtkx:refresh" }) }));
vi.mock("../src/vite-plugin-swc-ssr-refresh.js", () => ({ swcSsrRefresh: () => ({ name: "gtkx:swc-refresh" }) }));

import { RELOAD_EXIT_CODE } from "../src/dev-protocol.js";
import { createViteDevServer, handleFileChange, log, main, requestReload } from "../src/dev-runner.js";

type FakeServer = {
    close: ReturnType<typeof vi.fn>;
    moduleGraph: {
        getModuleById: ReturnType<typeof vi.fn>;
        invalidateModule: ReturnType<typeof vi.fn>;
    };
    ssrLoadModule: ReturnType<typeof vi.fn>;
    watcher: EventEmitter;
};

function createFakeServer(overrides: Partial<FakeServer> = {}): FakeServer {
    const watcher = new EventEmitter();
    return {
        close: vi.fn(async () => undefined),
        moduleGraph: {
            getModuleById: vi.fn(),
            invalidateModule: vi.fn(),
        },
        ssrLoadModule: vi.fn(async () => ({})),
        watcher,
        ...overrides,
    };
}

describe("log", () => {
    it("prefixes the message with [gtkx] and writes to console.log", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        log("hello");
        expect(spy).toHaveBeenCalledWith("[gtkx] hello");
        spy.mockRestore();
    });
});

describe("createViteDevServer", () => {
    beforeEach(() => {
        createServerMock.mockReset();
    });

    it("forwards root and required custom options to vite.createServer", async () => {
        const fakeServer = {} as ViteDevServer;
        createServerMock.mockResolvedValueOnce(fakeServer);

        const result = await createViteDevServer("/proj");

        expect(result).toBe(fakeServer);
        const config = createServerMock.mock.calls[0]?.[0];
        expect(config.root).toBe("/proj");
        expect(config.appType).toBe("custom");
        expect(config.server).toEqual({ middlewareMode: true });
        expect(config.optimizeDeps).toEqual({ noDiscovery: true, include: [] });
        expect(config.ssr).toEqual({ external: true });
    });

    it("registers gtkx plugins plus the react-dom-stripping post plugin", async () => {
        createServerMock.mockResolvedValueOnce({} as ViteDevServer);

        await createViteDevServer("/proj");

        const config = createServerMock.mock.calls[0]?.[0];
        const names = (config.plugins as Array<{ name: string }>).map((p) => p.name);
        expect(names).toContain("gtkx:gsettings");
        expect(names).toContain("gtkx:assets");
        expect(names).toContain("gtkx:swc-refresh");
        expect(names).toContain("gtkx:refresh");
        expect(names).toContain("gtkx:remove-react-dom-optimized");
    });

    it("filters react-dom entries out of optimizeDeps.include via the post plugin's config hook", async () => {
        createServerMock.mockResolvedValueOnce({} as ViteDevServer);

        await createViteDevServer("/proj");

        const config = createServerMock.mock.calls[0]?.[0];
        const stripper = (
            config.plugins as Array<{ name: string; config?: (cfg: Record<string, unknown>) => void }>
        ).find((p) => p.name === "gtkx:remove-react-dom-optimized");
        expect(stripper?.config).toBeTypeOf("function");

        const userConfig = { optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lodash"] } };
        stripper?.config?.(userConfig);

        expect(userConfig.optimizeDeps.include).toEqual(["react", "lodash"]);
    });

    it("defaults optimizeDeps.include to an empty array when the user config has no entries", () => {
        const stripper = {
            config(config: { optimizeDeps?: { include?: string[] } }) {
                config.optimizeDeps ??= {};
                config.optimizeDeps.include = config.optimizeDeps.include?.filter(
                    (dep: string) => dep !== "react-dom" && !dep.startsWith("react-dom/"),
                );
            },
        };

        const userConfig: { optimizeDeps?: { include?: string[] } } = {};
        stripper.config(userConfig);
        expect(userConfig.optimizeDeps).toEqual({ include: undefined });
    });
});

describe("requestReload", () => {
    it("closes the server and exits the process with RELOAD_EXIT_CODE", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        const server = createFakeServer();

        await requestReload(server as unknown as ViteDevServer);

        expect(server.close).toHaveBeenCalledOnce();
        expect(exitSpy).toHaveBeenCalledWith(RELOAD_EXIT_CODE);
        expect(logSpy.mock.calls.some((c) => String(c[0]).includes("Full reload"))).toBe(true);

        exitSpy.mockRestore();
        logSpy.mockRestore();
    });
});

describe("handleFileChange", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it("returns silently when the changed file is unknown to the module graph", async () => {
        const server = createFakeServer();
        server.moduleGraph.getModuleById.mockReturnValueOnce(undefined);

        await handleFileChange(server as unknown as ViteDevServer, "/x/y.ts");

        expect(server.moduleGraph.invalidateModule).not.toHaveBeenCalled();
        expect(server.ssrLoadModule).not.toHaveBeenCalled();
    });

    it("invalidates the module and all its importers, then fast-refreshes when the new module is a boundary", async () => {
        const server = createFakeServer();
        const importerA = { id: "a" };
        const importerB = { id: "b" };
        const module = { id: "/x/y.ts", importers: new Set([importerA, importerB]) };
        server.moduleGraph.getModuleById.mockReturnValueOnce(module);
        server.ssrLoadModule.mockResolvedValueOnce({ __isBoundary: true });

        await handleFileChange(server as unknown as ViteDevServer, "/x/y.ts");

        expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(module);
        expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerA);
        expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerB);
        const messages = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(messages.some((m: string) => m.includes("Fast refreshing"))).toBe(true);
        expect(messages.some((m: string) => m.includes("Fast refresh complete"))).toBe(true);
    });

    it("requests a full reload when the new module is not a refresh boundary", async () => {
        const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        const server = createFakeServer();
        const module = { id: "/x/y.ts", importers: new Set() };
        server.moduleGraph.getModuleById.mockReturnValueOnce(module);
        server.ssrLoadModule.mockResolvedValueOnce({});

        await handleFileChange(server as unknown as ViteDevServer, "/x/y.ts");

        expect(server.close).toHaveBeenCalledOnce();
        expect(exitSpy).toHaveBeenCalledWith(RELOAD_EXIT_CODE);

        exitSpy.mockRestore();
    });
});

describe("main", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let logSpy: ReturnType<typeof vi.spyOn>;
    let originalArgv: string[];

    beforeEach(() => {
        vi.clearAllMocks();
        exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        originalArgv = process.argv;
    });

    afterEach(() => {
        exitSpy.mockRestore();
        errorSpy.mockRestore();
        logSpy.mockRestore();
        process.argv = originalArgv;
    });

    it("prints an error and exits 1 when no entry is provided", async () => {
        process.argv = ["node", "runner"];
        exitSpy.mockImplementationOnce((() => {
            throw new Error("__exit__");
        }) as never);

        await expect(main()).rejects.toThrow("__exit__");

        expect(errorSpy).toHaveBeenCalledWith("[gtkx-dev-runner] Missing entry argument");
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("starts an MCP client when the loaded entry registers a default GApplication", async () => {
        process.argv = ["node", "runner", "src/index.tsx"];
        const server = createFakeServer();
        createServerMock.mockResolvedValueOnce(server as unknown as ViteDevServer);
        gioGetDefault.mockReturnValueOnce({ applicationId: "com.example.app" });

        await main();

        expect(server.ssrLoadModule).toHaveBeenCalled();
        expect(startMcpClientMock).toHaveBeenCalledWith("com.example.app");
        const messages = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(messages.some((m: string) => m.includes("Connected app id: com.example.app"))).toBe(true);
        expect(messages.some((m: string) => m.includes("HMR enabled"))).toBe(true);
    });

    it("skips MCP startup when no GApplication is registered", async () => {
        process.argv = ["node", "runner", "src/index.tsx"];
        const server = createFakeServer();
        createServerMock.mockResolvedValueOnce(server as unknown as ViteDevServer);
        gioGetDefault.mockReturnValueOnce(null);

        await main();

        expect(startMcpClientMock).not.toHaveBeenCalled();
        const messages = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(messages.some((m: string) => m.includes("MCP client not started"))).toBe(true);
    });

    it("registers a stop handler that closes the server and stops the MCP client", async () => {
        process.argv = ["node", "runner", "src/index.tsx"];
        const server = createFakeServer();
        createServerMock.mockResolvedValueOnce(server as unknown as ViteDevServer);

        await main();

        const stopCall = eventsOn.mock.calls.find((call) => call[0] === "stop");
        expect(stopCall).toBeDefined();
        const handler = stopCall?.[1] as () => void;
        handler();
        expect(stopMcpClientMock).toHaveBeenCalled();
        expect(server.close).toHaveBeenCalled();
    });

    it("forwards watcher 'change' events into handleFileChange", async () => {
        process.argv = ["node", "runner", "src/index.tsx"];
        const server = createFakeServer();
        server.moduleGraph.getModuleById.mockReturnValueOnce(undefined);
        createServerMock.mockResolvedValueOnce(server as unknown as ViteDevServer);

        await main();
        server.watcher.emit("change", "/some/file.ts");
        await new Promise((r) => setImmediate(r));

        expect(server.moduleGraph.getModuleById).toHaveBeenCalledWith("/some/file.ts");
    });
});
