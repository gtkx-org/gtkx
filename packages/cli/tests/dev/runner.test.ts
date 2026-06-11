import { EventEmitter } from "node:events";
import type { Plugin, ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELOAD_EXIT_CODE } from "../../src/dev/protocol.js";
import { createDevRunner, type DevRunnerDeps } from "../../src/dev/runner.js";
import { main } from "../../src/dev/runner-main.js";

type FakeServer = {
    close: ReturnType<typeof vi.fn>;
    moduleGraph: {
        getModuleById: ReturnType<typeof vi.fn>;
        invalidateModule: ReturnType<typeof vi.fn>;
    };
    ssrLoadModule: ReturnType<typeof vi.fn>;
    watcher: EventEmitter;
};

const createFakeServer = (overrides: Partial<FakeServer> = {}): FakeServer => {
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
};

type Harness = {
    deps: DevRunnerDeps;
    server: FakeServer;
    createServer: ReturnType<typeof vi.fn>;
    whenStopped: ReturnType<typeof vi.fn>;
    startMcp: ReturnType<typeof vi.fn>;
    stopMcp: ReturnType<typeof vi.fn>;
    performRefresh: ReturnType<typeof vi.fn>;
    isBoundary: ReturnType<typeof vi.fn>;
    installAppTeardown: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    exit: ReturnType<typeof vi.fn>;
    plugins: Plugin[];
    applicationId: string | null;
};

const buildHarness = (
    overrides: Partial<{
        applicationId: string | null;
        configuredApplicationId: string;
        isBoundary: (mod: Record<string, unknown>) => boolean;
    }> = {},
): Harness => {
    const server = createFakeServer();
    const plugins = [
        { name: "gtkx:gsettings" },
        { name: "gtkx:assets" },
        { name: "gtkx:swc-refresh" },
        { name: "gtkx:refresh" },
        { name: "gtkx:skip-react-dom-optimize" },
    ] as Plugin[];
    const applicationId = overrides.applicationId ?? null;
    const createServer = vi.fn<DevRunnerDeps["createServer"]>(async () => server as unknown as ViteDevServer);
    const whenStopped = vi.fn<DevRunnerDeps["whenStopped"]>(() => new Promise<void>(() => {}));
    const startMcp = vi.fn<DevRunnerDeps["startMcpClient"]>(async () => undefined);
    const stopMcp = vi.fn<DevRunnerDeps["stopMcpClient"]>();
    const installAppTeardown = vi.fn<DevRunnerDeps["installApplicationTeardown"]>(async () => undefined);
    const performRefresh = vi.fn<DevRunnerDeps["performRefresh"]>();
    const isBoundary = vi.fn<DevRunnerDeps["isReactRefreshBoundary"]>((mod) =>
        overrides.isBoundary ? overrides.isBoundary(mod) : mod.__isBoundary === true,
    );
    const log = vi.fn<DevRunnerDeps["log"]>();
    const exit = vi.fn<DevRunnerDeps["exit"]>((() => undefined) as never);
    const deps: DevRunnerDeps = {
        createServer,
        whenStopped,
        getApplicationId: () => applicationId,
        getConfiguredApplicationId: async () => overrides.configuredApplicationId,
        startMcpClient: startMcp,
        stopMcpClient: stopMcp,
        installApplicationTeardown: installAppTeardown,
        performRefresh,
        isReactRefreshBoundary: isBoundary,
        plugins: () => plugins,
        log,
        exit,
    };
    return {
        server,
        plugins,
        applicationId,
        createServer,
        whenStopped,
        startMcp,
        stopMcp,
        installAppTeardown,
        performRefresh,
        isBoundary,
        log,
        exit,
        deps,
    };
};

const ENTRY = "/abs/src/main.tsx";

const flushTick = (): Promise<void> => new Promise((r) => setImmediate(r));

const startRunner = async (harness: Harness): Promise<void> => {
    const runner = createDevRunner(harness.deps);
    await runner.run(ENTRY);
};

const emitChangeAndFlush = async (harness: Harness, file: string, ticks: number): Promise<void> => {
    harness.server.watcher.emit("change", file);
    for (let i = 0; i < ticks; i++) {
        await flushTick();
    }
};

const loggedMessages = (harness: Harness): string[] => harness.log.mock.calls.map((c: unknown[]) => String(c[0]));

const startRunnerAndExpectMcpConnected = async (harness: Harness, applicationId: string): Promise<void> => {
    await startRunner(harness);
    expect(harness.startMcp).toHaveBeenCalledWith(applicationId, expect.any(Function));
    const messages = loggedMessages(harness);
    expect(messages.some((m) => m.includes(`Connected application id: ${applicationId}`))).toBe(true);
};

describe("createDevRunner (vite config)", () => {
    it("calls createServer with the resolved root, custom mode, supplied plugins, and ssr options", async () => {
        const harness = buildHarness();

        await startRunner(harness);

        expect(harness.createServer).toHaveBeenCalledOnce();
        const config = harness.createServer.mock.calls[0]?.[0];
        expect(config.root).toBe(process.cwd());
        expect(config.appType).toBe("custom");
        expect(config.server).toEqual({ middlewareMode: true });
        expect(config.optimizeDeps).toEqual({ noDiscovery: true, include: [] });
        expect(config.ssr).toEqual({
            external: true,
            noExternal: [/^@gtkx\/(config|react|jsx|animate)(\/|$)/, /[/\\]\.gtkx[/\\]/],
        });
        const names = (config.plugins as Array<{ name: string }>).map((p) => p.name);
        expect(names).toEqual([
            "gtkx:gsettings",
            "gtkx:assets",
            "gtkx:swc-refresh",
            "gtkx:refresh",
            "gtkx:skip-react-dom-optimize",
        ]);
    });
});

describe("createDevRunner (entry loading)", () => {
    it("loads the user's entry via ssrLoadModule", async () => {
        const harness = buildHarness();

        await startRunner(harness);

        expect(harness.server.ssrLoadModule).toHaveBeenCalledWith(ENTRY);
    });
});

describe("createDevRunner (application teardown)", () => {
    it("installs a teardown that restarts the runner via the reload exit code", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });

        await startRunner(harness);

        expect(harness.installAppTeardown).toHaveBeenCalledTimes(1);
        const [, onTeardown] = harness.installAppTeardown.mock.calls[0] as [unknown, () => void];
        onTeardown();
        expect(harness.exit).toHaveBeenCalledWith(RELOAD_EXIT_CODE);
        expect(loggedMessages(harness).some((m) => m.includes("restarting dev runner"))).toBe(true);
    });
});

describe("createDevRunner (MCP lifecycle)", () => {
    it("starts the MCP client when the entry registers a Gio.Application", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });

        await startRunnerAndExpectMcpConnected(harness, "com.example.app");

        expect(loggedMessages(harness).some((m) => m.includes("HMR enabled"))).toBe(true);
    });

    it("registers under the configured applicationId when gtkx.config.ts declares one", async () => {
        const harness = buildHarness({
            applicationId: "com.example.override",
            configuredApplicationId: "com.example.app",
        });

        await startRunnerAndExpectMcpConnected(harness, "com.example.app");
    });

    it("skips MCP startup when no Gio.Application is registered", async () => {
        const harness = buildHarness({ applicationId: null, configuredApplicationId: "com.example.app" });

        await startRunner(harness);

        expect(harness.startMcp).not.toHaveBeenCalled();
    });

    it("skips MCP startup when no Gio.Application is registered and no config id is declared", async () => {
        const harness = buildHarness({ applicationId: null });

        await startRunner(harness);

        expect(harness.startMcp).not.toHaveBeenCalled();
        expect(loggedMessages(harness).some((m) => m.includes("MCP client not started"))).toBe(true);
    });

    it("tears down the dev server and MCP client when the runtime stops", async () => {
        const harness = buildHarness();
        const { promise: whenStoppedPromise, resolve: resolveStopped } = Promise.withResolvers<void>();
        harness.whenStopped.mockReturnValueOnce(whenStoppedPromise);

        await startRunner(harness);

        resolveStopped();
        await flushTick();

        expect(harness.stopMcp).toHaveBeenCalled();
        expect(harness.server.close).toHaveBeenCalled();
    });
});

describe("createDevRunner (file watcher wiring)", () => {
    it("forwards 'change' events into the file-change pipeline", async () => {
        const harness = buildHarness();
        harness.server.moduleGraph.getModuleById.mockReturnValueOnce(undefined);

        await startRunner(harness);

        await emitChangeAndFlush(harness, "/some/file.ts", 1);

        expect(harness.server.moduleGraph.getModuleById).toHaveBeenCalledWith("/some/file.ts");
    });

    it("ignores 'change' events for files not in the module graph", async () => {
        const harness = buildHarness();
        harness.server.moduleGraph.getModuleById.mockReturnValueOnce(undefined);

        await startRunner(harness);

        await emitChangeAndFlush(harness, "/x/unknown.ts", 1);

        expect(harness.server.moduleGraph.invalidateModule).not.toHaveBeenCalled();
        expect(harness.server.ssrLoadModule).toHaveBeenCalledTimes(1);
    });
});

describe("createDevRunner (file watcher dispatch)", () => {
    it("invalidates the module and importers, then fast-refreshes on a boundary", async () => {
        const harness = buildHarness();
        const importerA = { id: "a" };
        const importerB = { id: "b" };
        const module = { id: "/x/y.ts", importers: new Set([importerA, importerB]) };

        await startRunner(harness);

        harness.server.moduleGraph.getModuleById.mockReturnValueOnce(module);
        harness.server.ssrLoadModule.mockResolvedValueOnce({ __isBoundary: true });

        await emitChangeAndFlush(harness, "/x/y.ts", 2);

        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(module);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerA);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerB);
        expect(harness.performRefresh).toHaveBeenCalled();
    });

    it("requests a full reload via exit(RELOAD_EXIT_CODE) when the new module is not a boundary", async () => {
        const harness = buildHarness();
        const module = { id: "/x/y.ts", importers: new Set() };

        await startRunner(harness);

        harness.server.moduleGraph.getModuleById.mockReturnValueOnce(module);
        harness.server.ssrLoadModule.mockResolvedValueOnce({});

        await emitChangeAndFlush(harness, "/x/y.ts", 2);

        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RELOAD_EXIT_CODE);
    });
});

describe("main (argv parsing)", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let originalArgv: string[];

    beforeEach(() => {
        originalArgv = process.argv;
        exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        process.argv = originalArgv;
        exitSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("prints an error and exits 1 when no entry argument is supplied", async () => {
        process.argv = ["node", "runner"];
        exitSpy.mockImplementationOnce((() => {
            throw new Error("__exit__");
        }) as never);

        await expect(main()).rejects.toThrow("__exit__");

        expect(errorSpy).toHaveBeenCalledWith("[gtkx-dev-runner] Missing entry argument");
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
