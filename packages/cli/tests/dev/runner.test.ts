import { EventEmitter } from "node:events";
import type { Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELOAD_EXIT_CODE } from "../../src/dev/protocol.js";
import { createDevRunner, type DevRunnerDeps, type DevServer } from "../../src/dev/runner.js";
import { main } from "../../src/dev/runner-main.js";

type FakeServer = DevServer & {
    close: ReturnType<typeof vi.fn<DevServer["close"]>>;
    moduleGraph: {
        getModuleById: ReturnType<typeof vi.fn<DevServer["moduleGraph"]["getModuleById"]>>;
        invalidateModule: ReturnType<typeof vi.fn<DevServer["moduleGraph"]["invalidateModule"]>>;
    };
    ssrLoadModule: ReturnType<typeof vi.fn<DevServer["ssrLoadModule"]>>;
    watcher: EventEmitter;
};

const createFakeServer = (overrides: Partial<FakeServer> = {}): FakeServer => {
    const watcher = new EventEmitter();
    return {
        close: vi.fn<DevServer["close"]>(async () => undefined),
        moduleGraph: {
            getModuleById: vi.fn<DevServer["moduleGraph"]["getModuleById"]>(),
            invalidateModule: vi.fn<DevServer["moduleGraph"]["invalidateModule"]>(),
        },
        ssrLoadModule: vi.fn<DevServer["ssrLoadModule"]>(async () => ({})),
        watcher,
        ...overrides,
    };
};

type Harness = {
    deps: DevRunnerDeps;
    server: FakeServer;
    createServer: ReturnType<typeof vi.fn>;
    startMcp: ReturnType<typeof vi.fn>;
    stopMcp: ReturnType<typeof vi.fn>;
    performRefresh: ReturnType<typeof vi.fn>;
    isBoundary: ReturnType<typeof vi.fn>;
    installAppLifecycle: ReturnType<typeof vi.fn>;
    installShutdownHandlers: ReturnType<typeof vi.fn>;
    quitDefaultApp: ReturnType<typeof vi.fn>;
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
    const createServer = vi.fn<DevRunnerDeps["createServer"]>(async () => server);
    const startMcp = vi.fn<DevRunnerDeps["startMcpClient"]>(async () => undefined);
    const stopMcp = vi.fn<DevRunnerDeps["stopMcpClient"]>();
    const installAppLifecycle = vi.fn<DevRunnerDeps["installApplicationLifecycle"]>(async () => undefined);
    const installShutdownHandlers = vi.fn<DevRunnerDeps["installShutdownHandlers"]>();
    const quitDefaultApp = vi.fn<DevRunnerDeps["quitDefaultApplication"]>();
    const performRefresh = vi.fn<DevRunnerDeps["performRefresh"]>();
    const isBoundary = vi.fn<DevRunnerDeps["isReactRefreshBoundary"]>((mod) =>
        overrides.isBoundary ? overrides.isBoundary(mod) : mod["__isBoundary"] === true,
    );
    const log = vi.fn<DevRunnerDeps["log"]>();
    const exit = vi.fn<DevRunnerDeps["exit"]>((() => undefined) as never);
    const deps: DevRunnerDeps = {
        createServer,
        getApplicationId: () => applicationId,
        getConfiguredApplicationId: async () => overrides.configuredApplicationId,
        startMcpClient: startMcp,
        stopMcpClient: stopMcp,
        installApplicationLifecycle: installAppLifecycle,
        installShutdownHandlers,
        quitDefaultApplication: quitDefaultApp,
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
        startMcp,
        stopMcp,
        installAppLifecycle,
        installShutdownHandlers,
        quitDefaultApp,
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

type OnQuit = (runDefaultQuit: () => void) => void;

const installedQuit = (harness: Harness): OnQuit => {
    expect(harness.installAppLifecycle).toHaveBeenCalledTimes(1);
    const [, onQuit] = harness.installAppLifecycle.mock.calls[0] as [unknown, OnQuit];
    return onQuit;
};

type OnSignal = () => void | Promise<void>;

const installedSignalHandler = (harness: Harness): OnSignal => {
    expect(harness.installShutdownHandlers).toHaveBeenCalledTimes(1);
    const [onSignal] = harness.installShutdownHandlers.mock.calls[0] as [OnSignal];
    return onSignal;
};

const emitBoundaryChange = async (harness: Harness, file: string): Promise<void> => {
    harness.server.moduleGraph.getModuleById.mockReturnValueOnce({ importers: new Set<object>() });
    harness.server.ssrLoadModule.mockResolvedValueOnce({ __isBoundary: true });
    await emitChangeAndFlush(harness, file, 2);
};

describe("createDevRunner (application quit)", () => {
    it("runs the default quit and tears down the server when the application unmounts outside a refresh pass", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        const runDefault = vi.fn();

        await startRunner(harness);
        installedQuit(harness)(runDefault);

        expect(runDefault).toHaveBeenCalledTimes(1);
        expect(harness.stopMcp).toHaveBeenCalled();
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(loggedMessages(harness).some((m) => m.includes("Application quit"))).toBe(true);
    });

    it("logs an error when closing the server fails on quit", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        const error = new Error("close failed");
        harness.server.close = vi.fn<DevServer["close"]>(async () => {
            throw error;
        });
        const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        await startRunner(harness);
        installedQuit(harness)(vi.fn());
        await flushTick();

        const written = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
        expect(written).toContain("[gtkx] error Error closing server:");
        expect(written).toContain(error.stack ?? error.message);
        stderrSpy.mockRestore();
    });

    const expectRefreshRestart = async (schedule: (fireQuit: () => void) => void): Promise<Harness> => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        const runDefault = vi.fn();

        await startRunner(harness);
        const onQuit = installedQuit(harness);
        harness.performRefresh.mockImplementationOnce(() => schedule(() => onQuit(runDefault)));
        await emitBoundaryChange(harness, "/x/y.ts");

        expect(harness.exit).toHaveBeenCalledWith(RELOAD_EXIT_CODE);
        expect(runDefault).not.toHaveBeenCalled();
        return harness;
    };

    it("restarts the runner when the application unmounts during a refresh pass", async () => {
        const harness = await expectRefreshRestart((fireQuit) => fireQuit());

        expect(loggedMessages(harness).some((m) => m.includes("restarting dev runner"))).toBe(true);
    });

    it("restarts the runner when the refresh-induced unmount flushes on a microtask", async () => {
        await expectRefreshRestart((fireQuit) => queueMicrotask(fireQuit));
    });
});

describe("createDevRunner (quit outside a refresh pass)", () => {
    it("treats an unmount after the refresh window has closed as a quit", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        const runDefault = vi.fn();

        await startRunner(harness);
        const onQuit = installedQuit(harness);
        await emitBoundaryChange(harness, "/x/y.ts");
        await new Promise((resolve) => setTimeout(resolve, 0));
        onQuit(runDefault);

        expect(runDefault).toHaveBeenCalledTimes(1);
        expect(harness.exit).not.toHaveBeenCalled();
    });

    it("ignores application unmounts while the runtime is shutting down", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        const firstQuit = vi.fn();
        const secondQuit = vi.fn();

        await startRunner(harness);
        const onQuit = installedQuit(harness);
        onQuit(firstQuit);
        onQuit(secondQuit);

        expect(firstQuit).toHaveBeenCalledTimes(1);
        expect(secondQuit).not.toHaveBeenCalled();
        expect(harness.exit).not.toHaveBeenCalled();
    });
});

describe("createDevRunner (signal shutdown)", () => {
    it("quits the default application and tears down the server on a shutdown signal", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });

        await startRunner(harness);
        await installedSignalHandler(harness)();

        expect(harness.quitDefaultApp).toHaveBeenCalledTimes(1);
        expect(harness.stopMcp).toHaveBeenCalled();
        expect(harness.server.close).toHaveBeenCalled();
    });

    it("ignores a shutdown signal once the runtime is already shutting down", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });

        await startRunner(harness);
        const onSignal = installedSignalHandler(harness);
        await onSignal();
        await onSignal();

        expect(harness.quitDefaultApp).toHaveBeenCalledTimes(1);
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

    it("tears down the dev server and MCP client when the application quits", async () => {
        const harness = buildHarness();

        await startRunner(harness);

        installedQuit(harness)(vi.fn());

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
        const module = { id: "/x/y.ts", importers: new Set<object>() };

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
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let originalArgv: string[];

    beforeEach(() => {
        originalArgv = process.argv;
        exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        process.argv = originalArgv;
        exitSpy.mockRestore();
        stderrSpy.mockRestore();
    });

    it("prints an error and exits 1 when no entry argument is supplied", async () => {
        process.argv = ["node", "runner"];
        exitSpy.mockImplementationOnce((() => {
            throw new Error("__exit__");
        }) as never);

        await expect(main()).rejects.toThrow("__exit__");

        const written = stderrSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("");
        expect(written).toContain("[gtkx] error Missing entry argument");
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
