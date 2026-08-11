import type { InlineConfig, Plugin } from "vite";
import { describe, expect, it, vi } from "vitest";
import { createDevRunner, type DevRunnerDeps, type DevServer } from "../../src/dev/runner.js";
import { RESTART_EXIT_CODE } from "../../src/dev/supervisor.js";
import { collectLogged, type StderrSpy } from "../stderr-text.js";

type ChangeListener = (changedPath: string) => void;

type FakeServer = DevServer & {
    close: ReturnType<typeof vi.fn<DevServer["close"]>>;
    moduleGraph: {
        getModuleById: ReturnType<typeof vi.fn<DevServer["moduleGraph"]["getModuleById"]>>;
        invalidateModule: ReturnType<typeof vi.fn<DevServer["moduleGraph"]["invalidateModule"]>>;
    };
    ssrLoadModule: ReturnType<typeof vi.fn<DevServer["ssrLoadModule"]>>;
    watcher: ChangeEmitter;
};

type HarnessOverrides = {
    applicationId?: string | null;
    configuredApplicationId?: string;
    isBoundary?: (mod: Record<string, unknown>) => boolean;
    isApplicationRegistered?: boolean;
};

type HarnessMocks = {
    createServer: ReturnType<typeof vi.fn<DevRunnerDeps["createServer"]>>;
    startMcp: ReturnType<typeof vi.fn<DevRunnerDeps["startMcpClient"]>>;
    stopMcp: ReturnType<typeof vi.fn<DevRunnerDeps["stopMcpClient"]>>;
    performRefresh: ReturnType<typeof vi.fn<DevRunnerDeps["performRefresh"]>>;
    isBoundary: ReturnType<typeof vi.fn<DevRunnerDeps["isRefreshBoundary"]>>;
    watchAppShutdown: ReturnType<typeof vi.fn<DevRunnerDeps["watchApplicationShutdown"]>>;
    watchRenderErrors: ReturnType<typeof vi.fn<DevRunnerDeps["watchRenderErrors"]>>;
    watchUncaughtErrors: ReturnType<typeof vi.fn<DevRunnerDeps["watchUncaughtErrors"]>>;
    installShutdownHandlers: ReturnType<typeof vi.fn<DevRunnerDeps["installShutdownHandlers"]>>;
    quitDefaultApp: ReturnType<typeof vi.fn<DevRunnerDeps["quitDefaultApplication"]>>;
    log: ReturnType<typeof vi.fn<DevRunnerDeps["log"]>>;
    exit: ReturnType<typeof vi.fn<DevRunnerDeps["exit"]>>;
};

type Harness = HarnessMocks & {
    deps: DevRunnerDeps;
    server: FakeServer;
    plugins: Plugin[];
    applicationId: string | null;
    waitCalls: WaitCall[];
};

type WaitCall = { timeoutMs: number; shouldKeepWaiting: () => boolean };
type OnShutdown = () => void;
type OnSignal = () => void | Promise<void>;
type OnCause = (cause: unknown) => void;
type RenderErrorCall = Parameters<DevRunnerDeps["watchRenderErrors"]>;

const ENTRY = "/abs/src/main.tsx";

const PLUGIN_NAMES = [
    "gtkx:settings",
    "gtkx:css",
    "gtkx:swc-refresh",
    "gtkx:refresh-runtime",
    "gtkx:react-dom-prebundle",
];

const createFakeServer = (overrides: Partial<FakeServer> = {}): FakeServer => ({
    close: vi.fn<DevServer["close"]>(() => Promise.resolve()),
    moduleGraph: {
        getModuleById: vi.fn<DevServer["moduleGraph"]["getModuleById"]>(),
        invalidateModule: vi.fn<DevServer["moduleGraph"]["invalidateModule"]>(),
    },
    ssrLoadModule: vi.fn<DevServer["ssrLoadModule"]>(() => Promise.resolve({})),
    watcher: new ChangeEmitter(),
    ...overrides,
});

const buildMocks = (server: FakeServer, overrides: HarnessOverrides): HarnessMocks => ({
    createServer: vi.fn<DevRunnerDeps["createServer"]>(() => Promise.resolve(server)),
    startMcp: vi.fn<DevRunnerDeps["startMcpClient"]>(() => Promise.resolve()),
    stopMcp: vi.fn<DevRunnerDeps["stopMcpClient"]>(),
    watchAppShutdown: vi.fn<DevRunnerDeps["watchApplicationShutdown"]>(),
    watchRenderErrors: vi.fn<DevRunnerDeps["watchRenderErrors"]>(() => Promise.resolve()),
    watchUncaughtErrors: vi.fn<DevRunnerDeps["watchUncaughtErrors"]>(),
    installShutdownHandlers: vi.fn<DevRunnerDeps["installShutdownHandlers"]>(),
    quitDefaultApp: vi.fn<DevRunnerDeps["quitDefaultApplication"]>(),
    performRefresh: vi.fn<DevRunnerDeps["performRefresh"]>(),
    isBoundary: vi.fn<DevRunnerDeps["isRefreshBoundary"]>((mod) =>
        overrides.isBoundary ? overrides.isBoundary(mod) : mod.isBoundary === true,
    ),
    log: vi.fn<DevRunnerDeps["log"]>(),
    exit: vi.fn<DevRunnerDeps["exit"]>(((): void => undefined) as never),
});

const buildDeps = (
    mocks: HarnessMocks,
    plugins: Plugin[],
    overrides: HarnessOverrides,
    waitCalls: WaitCall[],
): DevRunnerDeps => ({
    createServer: mocks.createServer,
    waitForApplicationId: (timeoutMs, shouldKeepWaiting) => {
        waitCalls.push({ timeoutMs, shouldKeepWaiting });

        return Promise.resolve(overrides.applicationId ?? null);
    },
    getConfiguredApplicationId: () => Promise.resolve(overrides.configuredApplicationId),
    startMcpClient: mocks.startMcp,
    stopMcpClient: mocks.stopMcp,
    watchApplicationShutdown: mocks.watchAppShutdown,
    watchRenderErrors: mocks.watchRenderErrors,
    watchUncaughtErrors: mocks.watchUncaughtErrors,
    isApplicationRegistered: () => overrides.isApplicationRegistered ?? true,
    installShutdownHandlers: mocks.installShutdownHandlers,
    quitDefaultApplication: mocks.quitDefaultApp,
    performRefresh: mocks.performRefresh,
    isRefreshBoundary: mocks.isBoundary,
    plugins: () => plugins,
    log: mocks.log,
    exit: mocks.exit,
});

const buildHarness = (overrides: HarnessOverrides = {}): Harness => {
    const server = createFakeServer();
    const plugins = PLUGIN_NAMES.map((name) => ({ name })) as Plugin[];
    const mocks = buildMocks(server, overrides);
    const waitCalls: WaitCall[] = [];

    return {
        ...mocks,
        server,
        plugins,
        waitCalls,
        applicationId: overrides.applicationId ?? null,
        deps: buildDeps(mocks, plugins, overrides, waitCalls),
    };
};

const flushTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const settleTimers = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const captureStderr = (): StderrSpy => vi.spyOn(process.stderr, "write").mockImplementation(() => true);

const startRunner = async (harness: Harness): Promise<void> => {
    const runner = createDevRunner(harness.deps);
    await runner.run(ENTRY);
};

const startAppHarness = async (): Promise<Harness> => {
    const harness = buildHarness({ applicationId: "com.example.app" });
    await startRunner(harness);

    return harness;
};

const emitChangeAndFlush = async (harness: Harness, file: string, ticks: number): Promise<void> => {
    harness.server.watcher.emit("change", file);

    for (let i = 0; i < ticks; i++) {
        await flushTick();
    }
};

const startWithFailingEntry = async (cause: Error): Promise<Harness> => {
    const harness = buildHarness({ applicationId: "com.example.app" });
    harness.server.ssrLoadModule.mockRejectedValueOnce(cause);
    await startRunner(harness);

    return harness;
};

const startWithUnknownModule = async (harness: Harness, file: string): Promise<void> => {
    harness.server.moduleGraph.getModuleById.mockReturnValueOnce(undefined);
    await startRunner(harness);
    await emitChangeAndFlush(harness, file, 1);
};

const loggedMessages = (harness: Harness): string[] => harness.log.mock.calls.map(([message]) => message);

const createdServerConfig = (harness: Harness): InlineConfig => {
    const [config] = harness.createServer.mock.calls[0] ?? [];

    if (!config) {
        throw new Error("createServer was never called");
    }

    return config;
};

const expectMcpConnectedAfterStart = async (harness: Harness, applicationId: string): Promise<void> => {
    await startRunner(harness);
    expect(harness.startMcp).toHaveBeenCalledWith(applicationId, expect.any(Function));
    const messages = loggedMessages(harness);
    expect(messages.some((m) => m.includes(`Connected application ID: ${applicationId}`))).toBe(true);
};

const installedShutdown = (harness: Harness): OnShutdown => {
    expect(harness.watchAppShutdown).toHaveBeenCalledTimes(1);
    const [onShutdown] = harness.watchAppShutdown.mock.calls[0] as [OnShutdown];

    return onShutdown;
};

const installedSignalHandler = (harness: Harness): OnSignal => {
    expect(harness.installShutdownHandlers).toHaveBeenCalledTimes(1);
    const [onSignal] = harness.installShutdownHandlers.mock.calls[0] as [OnSignal];

    return onSignal;
};

const installedRenderErrorCall = (harness: Harness): RenderErrorCall => {
    expect(harness.watchRenderErrors).toHaveBeenCalledTimes(1);
    const [call] = harness.watchRenderErrors.mock.calls;

    if (!call) {
        throw new Error("watchRenderErrors was never called");
    }

    return call;
};

const installedRenderErrorHandler = (harness: Harness): OnCause => installedRenderErrorCall(harness)[1];

const installedUncaughtErrorHandler = (harness: Harness): OnCause => {
    expect(harness.watchUncaughtErrors).toHaveBeenCalledTimes(1);
    const [onUncaughtError] = harness.watchUncaughtErrors.mock.calls[0] as [OnCause];

    return onUncaughtError;
};

const emitBoundaryChange = async (harness: Harness, file: string): Promise<void> => {
    harness.server.moduleGraph.getModuleById.mockReturnValueOnce({ importers: new Set<object>() });
    harness.server.ssrLoadModule.mockResolvedValueOnce({ isBoundary: true });
    await emitChangeAndFlush(harness, file, 2);
};

const expectRefreshRestart = async (schedule: (fireShutdown: () => void) => void): Promise<Harness> => {
    const harness = await startAppHarness();
    const onShutdown = installedShutdown(harness);

    harness.performRefresh.mockImplementationOnce(() => {
        schedule(() => {
            onShutdown();
        });
    });

    await emitBoundaryChange(harness, "/x/y.ts");
    await settleTimers();
    expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);

    return harness;
};

const startFailedHarness = async (cause: Error): Promise<Harness> => {
    const harness = await startAppHarness();
    const onShutdown = installedShutdown(harness);
    const onRenderError = installedRenderErrorHandler(harness);

    harness.performRefresh.mockImplementationOnce(() => {
        onShutdown();
        onRenderError(cause);
    });

    await emitBoundaryChange(harness, "/x/y.ts");
    await settleTimers();

    return harness;
};

class ChangeEmitter {
    #listeners: ChangeListener[] = [];

    on(_event: "change", listener: ChangeListener): void {
        this.#listeners.push(listener);
    }

    emit(_event: "change", changedPath: string): void {
        for (const listener of this.#listeners) {
            listener(changedPath);
        }
    }
}

describe("createDevRunner (vite config)", () => {
    it("calls createServer with the resolved root, custom mode, supplied plugins, and ssr options", async () => {
        const harness = buildHarness();
        await startRunner(harness);
        expect(harness.createServer).toHaveBeenCalledOnce();
        const config = createdServerConfig(harness);
        expect(config.root).toBe(process.cwd());
        expect(config.appType).toBe("custom");
        expect(config.server).toEqual({ middlewareMode: true });
        expect(config.optimizeDeps).toEqual({ noDiscovery: true, include: [] });

        expect(config.ssr).toEqual({
            external: true,
            noExternal: [/^@gtkx\/(?!(?:native|gi|gl|runtime|utils|css)(?:\/|$))/, /[/\\]\.gtkx[/\\]/],
        });

        const names = (config.plugins as Plugin[]).map((plugin) => plugin.name);
        expect(names).toEqual(PLUGIN_NAMES);
    });
});

describe("createDevRunner (entry loading)", () => {
    it("loads the user's entry via ssrLoadModule", async () => {
        const harness = buildHarness();
        await startRunner(harness);
        expect(harness.server.ssrLoadModule).toHaveBeenCalledWith(ENTRY);
    });
});

describe("createDevRunner (a command line the application refused)", () => {
    it("stops the runner instead of watching an application that never registered", async () => {
        const harness = buildHarness({ applicationId: "com.example.app", isApplicationRegistered: false });
        const previousExitCode = process.exitCode;
        process.exitCode = 1;
        await startRunner(harness);
        process.exitCode = previousExitCode;
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(1);
        expect(harness.watchAppShutdown).not.toHaveBeenCalled();
        expect(harness.startMcp).not.toHaveBeenCalled();
        expect(loggedMessages(harness).some((m) => m.includes("refused its command line"))).toBe(true);
    });

    it("keeps running when the application registered", async () => {
        const harness = await startAppHarness();
        expect(harness.server.close).not.toHaveBeenCalled();
        expect(harness.watchAppShutdown).toHaveBeenCalled();
    });
});

describe("createDevRunner (application shutdown)", () => {
    it("tears down the server when the application shuts down outside a refresh pass", async () => {
        const harness = await startAppHarness();
        installedShutdown(harness)();
        expect(harness.stopMcp).toHaveBeenCalled();
        expect(harness.server.close).toHaveBeenCalled();
        await flushTick();
        expect(harness.exit).toHaveBeenCalledWith(0);
        expect(loggedMessages(harness).some((m) => m.includes("Application quit"))).toBe(true);
    });

    it("logs an error when closing the server fails on shutdown", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        const error = new Error("close failed");
        harness.server.close = vi.fn<DevServer["close"]>(() => Promise.reject(error));
        const stderrSpy = captureStderr();
        await startRunner(harness);
        installedShutdown(harness)();
        await flushTick();
        const written = collectLogged(stderrSpy);
        expect(written).toContain("[gtkx] error Error closing server:");
        expect(written).toContain(error.stack ?? error.message);
        expect(harness.exit).toHaveBeenCalledWith(1);
        stderrSpy.mockRestore();
    });

    it("restarts the runner when the application shuts down during a refresh pass", async () => {
        const harness = await expectRefreshRestart((fireShutdown) => {
            fireShutdown();
        });

        expect(loggedMessages(harness).some((m) => m.includes("restarting dev runner"))).toBe(true);
    });

    it("restarts the runner when the refresh-induced shutdown flushes on a microtask", async () => {
        await expectRefreshRestart((fireShutdown) => {
            queueMicrotask(fireShutdown);
        });
    });
});

describe("createDevRunner (a component that throws)", () => {
    it("keeps the dev server up when a render error unmounts the application", async () => {
        const stderrSpy = captureStderr();
        const harness = await startFailedHarness(new Error("PROBE: deliberate render throw"));
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
        expect(written).toContain("Application error; keeping the dev server up.");
        expect(written).toContain("PROBE: deliberate render throw");
        expect(loggedMessages(harness).some((m) => m.includes("waiting for a change"))).toBe(true);
    });

    it("parks without restarting when the error is known before the unmount", async () => {
        const stderrSpy = captureStderr();
        const harness = await startAppHarness();
        const onShutdown = installedShutdown(harness);
        const onRenderError = installedRenderErrorHandler(harness);

        harness.performRefresh.mockImplementationOnce(() => {
            onRenderError(new Error("boom"));
            onShutdown();
        });

        await emitBoundaryChange(harness, "/x/y.ts");
        await settleTimers();
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
    });

    it("restarts on the next save so the fixed module is loaded fresh", async () => {
        const stderrSpy = captureStderr();
        const harness = await startFailedHarness(new Error("boom"));
        const loadsBefore = harness.server.ssrLoadModule.mock.calls.length;
        harness.server.moduleGraph.getModuleById.mockReturnValueOnce({ importers: new Set<object>() });
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        stderrSpy.mockRestore();
        expect(harness.server.ssrLoadModule).toHaveBeenCalledTimes(loadsBefore);
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });
});

describe("createDevRunner (an entry that fails to load)", () => {
    it("keeps watching instead of taking the whole command down", async () => {
        const stderrSpy = captureStderr();
        const harness = await startWithFailingEntry(new ReferenceError("Extra is not defined"));
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.startMcp).not.toHaveBeenCalled();
        expect(written).toContain("Extra is not defined");
        expect(loggedMessages(harness).some((m) => m.includes("HMR enabled"))).toBe(true);
    });

    it("stops polling for the application once the entry has failed", async () => {
        const stderrSpy = captureStderr();
        const harness = await startWithFailingEntry(new Error("boom"));
        stderrSpy.mockRestore();
        const [wait] = harness.waitCalls;
        expect(wait?.shouldKeepWaiting()).toBe(false);
    });

    it("keeps polling for the application while the entry is healthy", async () => {
        const harness = await startAppHarness();
        const [wait] = harness.waitCalls;
        expect(wait?.shouldKeepWaiting()).toBe(true);
    });
});

describe("createDevRunner (error reporting)", () => {
    it("reports a render error once when the process also reports it as uncaught", async () => {
        const stderrSpy = captureStderr();
        const cause = new Error("PROBE: deliberate render throw");
        const harness = await startFailedHarness(cause);
        installedUncaughtErrorHandler(harness)(cause);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(written.split("keeping the dev server up.")).toHaveLength(2);
    });

    it("survives an uncaught error the runtime raises outside a refresh", async () => {
        const stderrSpy = captureStderr();
        const harness = await startAppHarness();
        installedUncaughtErrorHandler(harness)(new Error("PROBE: throw inside useEffect"));
        installedShutdown(harness)();
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
        expect(written).toContain("PROBE: throw inside useEffect");
    });

    it("starts anyway when the render error handler cannot be installed", async () => {
        const stderrSpy = captureStderr();
        const harness = buildHarness({ applicationId: "com.example.app" });
        harness.watchRenderErrors.mockRejectedValueOnce(new Error("no @gtkx/react here"));
        await startRunner(harness);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(written).toContain("Could not watch for render errors:");
        expect(harness.startMcp).toHaveBeenCalled();
        expect(loggedMessages(harness).some((m) => m.includes("HMR enabled"))).toBe(true);
    });

    it("installs the render error handler through the application's module graph", async () => {
        const harness = await startAppHarness();
        const [loadAppModule] = installedRenderErrorCall(harness);
        await loadAppModule("@gtkx/react/internal");
        expect(harness.server.ssrLoadModule).toHaveBeenCalledWith("@gtkx/react/internal");
    });
});

describe("createDevRunner (shutdown outside a refresh pass)", () => {
    it("treats a shutdown after the refresh window has closed as a quit", async () => {
        const harness = await startAppHarness();
        const onShutdown = installedShutdown(harness);
        await emitBoundaryChange(harness, "/x/y.ts");
        await settleTimers();
        onShutdown();
        expect(harness.server.close).toHaveBeenCalled();
        await flushTick();
        expect(harness.exit).toHaveBeenCalledWith(0);
    });

    it("ignores application shutdowns while the runtime is shutting down", async () => {
        const harness = await startAppHarness();
        const onShutdown = installedShutdown(harness);
        onShutdown();
        onShutdown();
        expect(harness.server.close).toHaveBeenCalledTimes(1);
        await flushTick();
        expect(harness.exit).toHaveBeenCalledExactlyOnceWith(0);
    });
});

describe("createDevRunner (signal shutdown)", () => {
    it("quits the default application and tears down the server on a shutdown signal", async () => {
        const harness = await startAppHarness();
        await installedSignalHandler(harness)();
        expect(harness.quitDefaultApp).toHaveBeenCalledTimes(1);
        expect(harness.stopMcp).toHaveBeenCalled();
        expect(harness.server.close).toHaveBeenCalled();
    });

    it("ignores a shutdown signal once the runtime is already shutting down", async () => {
        const harness = await startAppHarness();
        const onSignal = installedSignalHandler(harness);
        await onSignal();
        await onSignal();
        expect(harness.quitDefaultApp).toHaveBeenCalledTimes(1);
    });
});

describe("createDevRunner (MCP lifecycle)", () => {
    it("starts the MCP client when the entry registers a Gio.Application", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        await expectMcpConnectedAfterStart(harness, "com.example.app");
        expect(loggedMessages(harness).some((m) => m.includes("HMR enabled"))).toBe(true);
    });

    it("registers under the configured applicationId when gtkx.config.ts declares one", async () => {
        const harness = buildHarness({
            applicationId: "com.example.override",
            configuredApplicationId: "com.example.app",
        });

        await expectMcpConnectedAfterStart(harness, "com.example.app");
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

    it("tears down the dev server and MCP client when the application shuts down", async () => {
        const harness = await startAppHarness();
        installedShutdown(harness)();
        expect(harness.stopMcp).toHaveBeenCalled();
        expect(harness.server.close).toHaveBeenCalled();
    });
});

describe("createDevRunner (file watcher wiring)", () => {
    it("forwards 'change' events into the file-change pipeline", async () => {
        const harness = buildHarness();
        await startWithUnknownModule(harness, "/some/file.ts");
        expect(harness.server.moduleGraph.getModuleById).toHaveBeenCalledWith("/some/file.ts");
    });

    it("ignores 'change' events for files not in the module graph", async () => {
        const harness = buildHarness();
        await startWithUnknownModule(harness, "/x/unknown.ts");
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
        harness.server.ssrLoadModule.mockResolvedValueOnce({ isBoundary: true });
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(module);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerA);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerB);
        expect(harness.performRefresh).toHaveBeenCalled();
    });

    it("requests a full restart via exit(RESTART_EXIT_CODE) when the new module is not a boundary", async () => {
        const harness = buildHarness();
        const module = { id: "/x/y.ts", importers: new Set<object>() };
        await startRunner(harness);
        harness.server.moduleGraph.getModuleById.mockReturnValueOnce(module);
        harness.server.ssrLoadModule.mockResolvedValueOnce({});
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });

    it("restarts without re-executing when the loaded module is already a non-boundary", async () => {
        const harness = buildHarness();
        const module = { id: "/x/y.ts", importers: new Set<object>(), ssrModule: { listviewColorsDemo: {} } };
        await startRunner(harness);
        expect(harness.server.ssrLoadModule).toHaveBeenCalledTimes(1);
        harness.server.moduleGraph.getModuleById.mockReturnValueOnce(module);
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        expect(harness.server.moduleGraph.invalidateModule).not.toHaveBeenCalled();
        expect(harness.server.ssrLoadModule).toHaveBeenCalledTimes(1);
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });
});
