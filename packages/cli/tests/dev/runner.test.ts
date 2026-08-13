import type { ApplicationInstance } from "@gtkx/runtime/internal";
import type { InlineConfig, Plugin } from "vite";
import { describe, expect, it, vi } from "vitest";
import type { DevServerWatchEvent } from "../../src/dev/vite-dev-server.js";
import { createDevRunner, type DevRunnerDeps, type DevServer } from "../../src/dev/runner.js";
import { RESTART_EXIT_CODE } from "../../src/dev/supervisor.js";
import { collectLogged, type StderrSpy } from "../stderr-text.js";

type ChangeListener = (changedPath: string) => void;

type FakeModule = {
    importers: Set<object>;
    ssrModule: Record<string, unknown> | null;
    ssrTransformResult: object | null;
};

type FakeModules = Map<string, FakeModule>;
type FakeExports = Record<string, unknown>;
type LoadHandler = (id: string) => Promise<FakeExports>;

type LoadPlan = {
    next: (handler: LoadHandler) => void;
    always: (handler: LoadHandler) => void;
    take: () => LoadHandler;
};

type FakeServer = DevServer & {
    close: ReturnType<typeof vi.fn<DevServer["close"]>>;
    moduleGraph: {
        getModuleById: ReturnType<typeof vi.fn<DevServer["moduleGraph"]["getModuleById"]>>;
        invalidateModule: ReturnType<typeof vi.fn<DevServer["moduleGraph"]["invalidateModule"]>>;
    };
    ssrLoadModule: ReturnType<typeof vi.fn<DevServer["ssrLoadModule"]>>;
    ssrFixStacktrace: ReturnType<typeof vi.fn<DevServer["ssrFixStacktrace"]>>;
    watcher: ChangeEmitter;
    modules: FakeModules;
    loads: LoadPlan;
    deduped: string[];
};

type HarnessOverrides = {
    applicationId?: string | null;
    configuredApplicationId?: string;
    isBoundary?: (mod: Record<string, unknown>) => boolean;
    performRefresh?: () => unknown;
    staleExportName?: DevRunnerDeps["staleExportName"];
    applicationInstance?: ApplicationInstance;
    readFileRevision?: DevRunnerDeps["readFileRevision"];
    whileWaiting?: () => void;
};

type FakeDisk = {
    read: () => string;
    write: (revision: string) => void;
};

type LoadAppModule = (id: string) => Promise<FakeExports>;

type HarnessMocks = {
    createServer: ReturnType<typeof vi.fn<DevRunnerDeps["createServer"]>>;
    startMcp: ReturnType<typeof vi.fn<DevRunnerDeps["startMcpClient"]>>;
    stopMcp: ReturnType<typeof vi.fn<DevRunnerDeps["stopMcpClient"]>>;
    performRefresh: ReturnType<typeof vi.fn<DevRunnerDeps["performRefresh"]>>;
    isBoundary: ReturnType<typeof vi.fn<DevRunnerDeps["isRefreshBoundary"]>>;
    staleExportName: ReturnType<typeof vi.fn<DevRunnerDeps["staleExportName"]>>;
    watchAppShutdown: ReturnType<typeof vi.fn<DevRunnerDeps["watchApplicationShutdown"]>>;
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
    state: HarnessState;
};

type HarnessState = {
    waitCalls: WaitCall[];
    applicationInstance: ApplicationInstance;
};

type WaitCall = { timeoutMs: number; shouldKeepWaiting: () => boolean };
type WatchedSave = { harness: Harness; written: string };
type OnShutdown = () => void;
type OnSignal = () => void | Promise<void>;
type OnCause = (cause: unknown) => void;

const ENTRY = "/abs/src/main.tsx";
const PARKED = "Waiting for a change to restart the application...";
const PROJECT_ROOT = "/x";
const VITE_CONFIG_FILE = "/x/vite.config.ts";
const CONFIG_DEPENDENCY_FILE = "/x/vite.shared.ts";
const ENV_FILE = "/x/.env";
const MODE_ENV_FILE = "/x/.env.development.local";
const OTHER_MODE_ENV_FILE = "/x/.env.production";
const WATCHED_FILE = "/x/component.tsx";
const OTHER_IMPORTER = "/x/panel.tsx";
const MISSING_FILE = "/x/theme.ts";
const MISSING_INDEX_FILE = "/x/theme/index.ts";
const NEXT_MISSING_FILE = "/x/palette.ts";
const UNRELATED_FILE = "/x/scratch.log";
const RESOLVE_FAILURE = "PROBE: Failed to load url ./theme.js";
const NEXT_RESOLVE_FAILURE = "PROBE: Failed to load url ./palette.js";
const BROKEN_FILE_FAILURE = "PROBE: theme.ts failed to parse";
const RETRY_LOG = "Retrying pending save";
const DROPPED_REFRESH = "Fast Refresh dropped";
const DROPPED_EXPORT_REASON = "no longer exports Widget, which its importers still hold";
const RENAMED_COMPONENT_REASON = "renamed the component it exports as default, which the window is still rendering";
const SETTLE_ROUNDS = 8;

const PLUGIN_NAMES = [
    "gtkx:settings",
    "gtkx:css",
    "gtkx:swc-refresh",
    "gtkx:refresh-runtime",
    "gtkx:react-dom-prebundle",
];

const loadNothing: LoadHandler = () => Promise.resolve({});

const createLoadPlan = (): LoadPlan => {
    const queued: LoadHandler[] = [];
    let fallback = loadNothing;

    return {
        next: (handler) => {
            queued.push(handler);
        },
        always: (handler) => {
            fallback = handler;
        },
        take: () => queued.shift() ?? fallback,
    };
};

const invalidateFakeModule = (modules: FakeModules, invalidated: object): void => {
    for (const module of modules.values()) {
        if (module !== invalidated) {
            continue;
        }

        module.ssrModule = null;
        module.ssrTransformResult = null;
    }
};

const transformFakeModule = (modules: FakeModules, id: string): void => {
    const module = modules.get(id);

    if (module) {
        module.ssrTransformResult = { id };
    }
};

const runFakeLoad = async (modules: FakeModules, handler: LoadHandler, id: string): Promise<FakeExports> => {
    const loadedExports = await handler(id);
    const module = modules.get(id);

    if (module) {
        module.ssrModule = loadedExports;
    }

    return loadedExports;
};

const forgetWhenDone = async (
    inFlight: Map<string, Promise<FakeExports>>,
    id: string,
    load: Promise<FakeExports>,
): Promise<FakeExports> => {
    try {
        return await load;
    } finally {
        inFlight.delete(id);
    }
};

const createFakeServer = (): FakeServer => {
    const modules: FakeModules = new Map();
    const inFlight: Map<string, Promise<FakeExports>> = new Map();
    const loads = createLoadPlan();
    const deduped: string[] = [];

    const startLoad = (id: string): Promise<FakeExports> => {
        transformFakeModule(modules, id);
        const load = forgetWhenDone(inFlight, id, runFakeLoad(modules, loads.take(), id));
        inFlight.set(id, load);

        return load;
    };

    return {
        close: vi.fn<DevServer["close"]>(() => Promise.resolve()),
        config: {
            configFile: VITE_CONFIG_FILE,
            configFileDependencies: [CONFIG_DEPENDENCY_FILE],
            envDir: PROJECT_ROOT,
            mode: "development",
        },
        moduleGraph: {
            getModuleById: vi.fn<DevServer["moduleGraph"]["getModuleById"]>((id) => modules.get(id)),
            invalidateModule: vi.fn<DevServer["moduleGraph"]["invalidateModule"]>((invalidated) => {
                invalidateFakeModule(modules, invalidated);
            }),
        },
        ssrLoadModule: vi.fn<DevServer["ssrLoadModule"]>((id) => {
            const running = inFlight.get(id);

            if (!running) {
                return startLoad(id);
            }

            deduped.push(id);

            return running;
        }),
        ssrFixStacktrace: vi.fn<DevServer["ssrFixStacktrace"]>(),
        watcher: new ChangeEmitter(),
        modules,
        loads,
        deduped,
    };
};

const buildMocks = (server: FakeServer, overrides: HarnessOverrides): HarnessMocks => ({
    createServer: vi.fn<DevRunnerDeps["createServer"]>(() => Promise.resolve(server)),
    startMcp: vi.fn<DevRunnerDeps["startMcpClient"]>(() => Promise.resolve()),
    stopMcp: vi.fn<DevRunnerDeps["stopMcpClient"]>(),
    watchAppShutdown: vi.fn<DevRunnerDeps["watchApplicationShutdown"]>(),
    watchUncaughtErrors: vi.fn<DevRunnerDeps["watchUncaughtErrors"]>(),
    installShutdownHandlers: vi.fn<DevRunnerDeps["installShutdownHandlers"]>(),
    quitDefaultApp: vi.fn<DevRunnerDeps["quitDefaultApplication"]>(),
    performRefresh: vi.fn<DevRunnerDeps["performRefresh"]>(overrides.performRefresh ?? ((): void => undefined)),
    isBoundary: vi.fn<DevRunnerDeps["isRefreshBoundary"]>((mod) =>
        overrides.isBoundary ? overrides.isBoundary(mod) : mod.isBoundary === true,
    ),
    staleExportName: vi.fn<DevRunnerDeps["staleExportName"]>(overrides.staleExportName ?? ((): null => null)),
    log: vi.fn<DevRunnerDeps["log"]>(),
    exit: vi.fn<DevRunnerDeps["exit"]>(((): void => undefined) as never),
});

const buildDeps = (
    mocks: HarnessMocks,
    plugins: Plugin[],
    overrides: HarnessOverrides,
    state: HarnessState,
): DevRunnerDeps => ({
    createServer: mocks.createServer,
    waitForApplicationId: (timeoutMs, shouldKeepWaiting) => {
        state.waitCalls.push({ timeoutMs, shouldKeepWaiting });
        overrides.whileWaiting?.();

        return Promise.resolve(overrides.applicationId ?? null);
    },
    getConfiguredApplicationId: () => Promise.resolve(overrides.configuredApplicationId),
    startMcpClient: mocks.startMcp,
    stopMcpClient: mocks.stopMcp,
    watchApplicationShutdown: mocks.watchAppShutdown,
    watchUncaughtErrors: mocks.watchUncaughtErrors,
    getApplicationInstance: () => state.applicationInstance,
    installShutdownHandlers: mocks.installShutdownHandlers,
    quitDefaultApplication: mocks.quitDefaultApp,
    performRefresh: mocks.performRefresh,
    isRefreshBoundary: mocks.isBoundary,
    staleExportName: mocks.staleExportName,
    readFileRevision: overrides.readFileRevision ?? ((): Promise<string> => Promise.resolve("revision")),
    plugins: () => plugins,
    log: mocks.log,
    exit: mocks.exit,
});

const buildHarness = (overrides: HarnessOverrides = {}): Harness => {
    const server = createFakeServer();
    const plugins = PLUGIN_NAMES.map((name) => ({ name })) as Plugin[];
    const mocks = buildMocks(server, overrides);

    const state: HarnessState = {
        waitCalls: [],
        applicationInstance: overrides.applicationInstance ?? "primary",
    };

    return {
        ...mocks,
        server,
        plugins,
        state,
        applicationId: overrides.applicationId ?? null,
        deps: buildDeps(mocks, plugins, overrides, state),
    };
};

const flushTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const settleTimers = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const captureStderr = (): StderrSpy => vi.spyOn(process.stderr, "write").mockImplementation(() => true);

const startRunner = async (harness: Harness): Promise<void> => {
    const runner = createDevRunner(harness.deps);
    await runner.run(ENTRY);
};

const startAppHarness = async (overrides: HarnessOverrides = {}): Promise<Harness> => {
    const harness = buildHarness({ applicationId: "com.example.app", ...overrides });
    await startRunner(harness);

    return harness;
};

const startRemoteHarness = async (): Promise<Harness> => {
    const harness = buildHarness({ applicationId: "com.example.app", applicationInstance: "remote" });
    await startRunner(harness);

    return harness;
};

const emitChangeAndFlush = async (harness: Harness, file: string, ticks: number): Promise<void> => {
    harness.server.watcher.emit("change", file);

    for (let i = 0; i < ticks; i++) {
        await flushTick();
    }
};

const defineModule = (harness: Harness, id: string, overrides: Partial<FakeModule> = {}): FakeModule => {
    const module: FakeModule = {
        importers: new Set<object>(),
        ssrModule: null,
        ssrTransformResult: null,
        ...overrides,
    };

    harness.server.modules.set(id, module);

    return module;
};

const startWithFailingEntry = async (cause: Error): Promise<Harness> => {
    const harness = buildHarness({ applicationId: "com.example.app" });
    harness.server.loads.next(() => Promise.reject(cause));
    await startRunner(harness);

    return harness;
};

const startWithUnknownModule = async (harness: Harness, file: string): Promise<void> => {
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

const installedUncaughtErrorHandler = (harness: Harness): OnCause => {
    expect(harness.watchUncaughtErrors).toHaveBeenCalledTimes(1);
    const [onUncaughtError] = harness.watchUncaughtErrors.mock.calls[0] as [OnCause];

    return onUncaughtError;
};

const startWithDeadApplication = async (
    instance: ApplicationInstance,
    cause: Error,
    applicationId: string | null = "com.example.app",
): Promise<Harness> => {
    const harness: Harness = buildHarness({
        applicationId,
        applicationInstance: instance,
        whileWaiting: () => {
            installedUncaughtErrorHandler(harness)(cause);
        },
    });

    await startRunner(harness);

    return harness;
};

const startDyingAfterAttach = async (cause: Error): Promise<Harness> => {
    const harness: Harness = buildHarness({ applicationId: "com.example.app" });

    harness.startMcp.mockImplementationOnce(() => {
        harness.state.applicationInstance = "shutDown";
        installedUncaughtErrorHandler(harness)(cause);

        return Promise.resolve();
    });

    await startRunner(harness);

    return harness;
};

const emitBoundaryChange = async (harness: Harness, file: string): Promise<void> => {
    defineModule(harness, file);
    harness.server.loads.next(() => Promise.resolve({ isBoundary: true }));
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

const settleQueue = async (): Promise<void> => {
    for (let round = 0; round < SETTLE_ROUNDS; round++) {
        await settleTimers();
    }
};

const createFakeDisk = (initial: string): FakeDisk => {
    let revision = initial;

    return {
        read: () => revision,
        write: (next) => {
            revision = next;
        },
    };
};

const startDiskHarness = async (disk: FakeDisk): Promise<Harness> => {
    const harness = buildHarness({
        applicationId: "com.example.app",
        readFileRevision: () => Promise.resolve(disk.read()),
    });

    await startRunner(harness);
    defineModule(harness, WATCHED_FILE);
    harness.server.loads.always(() => Promise.resolve({ isBoundary: true, revision: disk.read() }));

    return harness;
};

const emitChangeAndSettle = async (harness: Harness, file: string): Promise<void> => {
    harness.server.watcher.emit("change", file);
    await settleQueue();
};

const committedRevision = (harness: Harness): unknown => harness.isBoundary.mock.calls.at(-1)?.[0].revision;

const installedTestingLoader = (harness: Harness): LoadAppModule => {
    const [, loadAppModule] = harness.startMcp.mock.calls[0] ?? [];

    if (!loadAppModule) {
        throw new Error("startMcpClient was never called");
    }

    return loadAppModule;
};

const trackLoadsWithLateSave = (harness: Harness, disk: FakeDisk, lateRevision: string): string[] => {
    const loads: string[] = [];

    harness.server.loads.always(() => {
        const revision = disk.read();
        loads.push(revision);

        if (loads.length === 1) {
            disk.write(lateRevision);
        }

        return Promise.resolve({ isBoundary: true, revision });
    });

    return loads;
};

const saveOnEveryLoad = (harness: Harness, disk: FakeDisk): (() => void) => {
    let saves = 1;
    let isChurning = true;

    harness.server.loads.always(() => {
        const revision = disk.read();

        if (isChurning) {
            saves += 1;
            disk.write(`MARKER ${String(saves)}`);
        }

        return Promise.resolve({ isBoundary: true, revision });
    });

    return () => {
        isChurning = false;
    };
};

const holdNextLoad = (harness: Harness, disk: FakeDisk): (() => void) => {
    const gate = Promise.withResolvers<null>();

    harness.server.loads.next(async () => {
        const revision = disk.read();
        await gate.promise;

        return { isBoundary: true, revision };
    });

    return () => {
        gate.resolve(null);
    };
};

const shutDownWhileLoading = (harness: Harness, onSignal: OnSignal): void => {
    harness.server.loads.always(async () => {
        await onSignal();

        return { isBoundary: true };
    });
};

const shutDownWhileSaving = (harness: Harness, disk: FakeDisk, onSignal: OnSignal): (() => number) => {
    let loads = 0;

    harness.server.loads.always(async () => {
        loads += 1;
        const revision = disk.read();
        disk.write(`MARKER ${String(loads + 1)}`);
        await onSignal();

        return { isBoundary: true, revision };
    });

    return () => loads;
};

const failLoadsWhileShuttingDown = (harness: Harness, onSignal: OnSignal): (() => number) => {
    let loads = 0;

    harness.server.loads.always(async () => {
        loads += 1;
        await onSignal();
        throw new Error("PROBE: the dev server is closed");
    });

    return () => loads;
};

const startFailedHarness = async (cause: Error): Promise<Harness> => {
    const harness = await startAppHarness();
    const onShutdown = installedShutdown(harness);
    const reportUncaught = installedUncaughtErrorHandler(harness);

    harness.performRefresh.mockImplementationOnce(() => {
        onShutdown();
        reportUncaught(cause);
    });

    await emitBoundaryChange(harness, "/x/y.ts");
    await settleTimers();

    return harness;
};

const emitWatchEventAndSettle = async (
    harness: Harness,
    event: DevServerWatchEvent,
    file: string,
): Promise<void> => {
    harness.server.watcher.emit(event, file);
    await settleQueue();
};

const watchServerConfigFile = async (
    event: DevServerWatchEvent,
    changedPath: string,
    prepare: (harness: Harness) => void = (): void => undefined,
): Promise<Harness> => {
    const harness = await startAppHarness();
    prepare(harness);
    await emitWatchEventAndSettle(harness, event, changedPath);

    return harness;
};

const expectServerConfigRestart = (harness: Harness, changedPath: string): void => {
    expect(loggedMessages(harness)).toContain(`Server config changed: ${changedPath}`);
    expect(harness.server.close).toHaveBeenCalled();
    expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
};

const failResolveOnSave = async (harness: Harness, importerPath: string): Promise<void> => {
    defineModule(harness, importerPath);
    harness.server.loads.next(() => Promise.reject(new Error(RESOLVE_FAILURE)));
    await emitChangeAndSettle(harness, importerPath);
};

const startWithFailedSave = async (): Promise<Harness> => {
    const stderrSpy = captureStderr();
    const harness = await startAppHarness();
    await failResolveOnSave(harness, WATCHED_FILE);
    stderrSpy.mockRestore();

    return harness;
};

const startWithTwoFailedSaves = async (): Promise<Harness> => {
    const stderrSpy = captureStderr();
    const harness = await startAppHarness();
    await failResolveOnSave(harness, WATCHED_FILE);
    await failResolveOnSave(harness, OTHER_IMPORTER);
    stderrSpy.mockRestore();

    return harness;
};

const startWithMissingEntryImport = async (): Promise<Harness> => {
    const stderrSpy = captureStderr();
    const harness = await startWithFailingEntry(new Error(RESOLVE_FAILURE));
    stderrSpy.mockRestore();

    return harness;
};

const messagesMatching = (harness: Harness, needle: string): string[] =>
    loggedMessages(harness).filter((message) => message.includes(needle));

const createdFileLogs = (harness: Harness): string[] => messagesMatching(harness, "File created");
const retryLogs = (harness: Harness): string[] => messagesMatching(harness, RETRY_LOG);
const startedLoads = (harness: Harness): number => harness.server.ssrLoadModule.mock.calls.length;

const appearWithBoundaryLoad = async (harness: Harness, createdPath: string): Promise<void> => {
    harness.server.loads.next(() => Promise.resolve({ isBoundary: true }));
    await emitWatchEventAndSettle(harness, "add", createdPath);
};

const Widget = (): null => null;
const Panel = (): null => null;
const patchesNothing = (): number => 0;

const saveWithExports = async (
    previous: FakeExports,
    next: FakeExports,
    overrides: HarnessOverrides = {},
): Promise<Harness> => {
    const harness = await startAppHarness(overrides);
    defineModule(harness, WATCHED_FILE, { ssrModule: previous });
    harness.server.loads.next(() => Promise.resolve(next));
    await emitChangeAndSettle(harness, WATCHED_FILE);

    return harness;
};

const saveWatchingStderr = async (
    previous: FakeExports,
    next: FakeExports,
    overrides: HarnessOverrides = {},
): Promise<WatchedSave> => {
    const stderrSpy = captureStderr();
    const harness = await saveWithExports(previous, next, overrides);
    const written = collectLogged(stderrSpy);
    stderrSpy.mockRestore();

    return { harness, written };
};

const expectDroppedRefreshRestart = (save: WatchedSave, reason: string): void => {
    expect(save.written).toContain(`${DROPPED_REFRESH}: ${WATCHED_FILE} ${reason}`);
    expect(loggedMessages(save.harness).some((message) => message.includes("Fast Refresh complete"))).toBe(false);
    expect(save.harness.server.close).toHaveBeenCalled();
    expect(save.harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
};

const expectAnnouncedRefresh = (save: WatchedSave): void => {
    expect(save.written).not.toContain(DROPPED_REFRESH);
    expect(loggedMessages(save.harness)).toContain("Fast Refresh complete");
    expect(save.harness.server.close).not.toHaveBeenCalled();
    expect(save.harness.exit).not.toHaveBeenCalled();
};

const appearWithFailingLoad = async (harness: Harness, createdPath: string, failure: string): Promise<string> => {
    const stderrSpy = captureStderr();
    harness.server.loads.next(() => Promise.reject(new Error(failure)));
    await emitWatchEventAndSettle(harness, "add", createdPath);
    const written = collectLogged(stderrSpy);
    stderrSpy.mockRestore();

    return written;
};

class ChangeEmitter {
    #listeners: Map<DevServerWatchEvent, ChangeListener[]> = new Map();

    on(event: DevServerWatchEvent, listener: ChangeListener): void {
        const listeners = this.#listeners.get(event) ?? [];
        listeners.push(listener);
        this.#listeners.set(event, listeners);
    }

    emit(event: DevServerWatchEvent, changedPath: string): void {
        const listeners = this.#listeners.get(event) ?? [];

        for (const listener of listeners) {
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

        expect(config.server).toEqual({
            middlewareMode: true,
            watch: { awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 } },
        });

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
        const harness = buildHarness({ applicationId: "com.example.app", applicationInstance: "unregistered" });
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

describe("createDevRunner (an application that quit before the runner attached)", () => {
    it("reports the quit rather than blaming a command line nothing refused", async () => {
        const harness = buildHarness({ applicationId: "com.example.app", applicationInstance: "shutDown" });
        await startRunner(harness);
        const messages = loggedMessages(harness);
        expect(messages.some((m) => m.includes("Application quit - stopping dev runner..."))).toBe(true);
        expect(messages.some((m) => m.includes("refused its command line"))).toBe(false);
    });

    it("closes the server and exits zero, the way the built application does", async () => {
        const harness = buildHarness({ applicationId: "com.example.app", applicationInstance: "shutDown" });
        const previousExitCode = process.exitCode;
        process.exitCode = undefined;
        await startRunner(harness);
        process.exitCode = previousExitCode;
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(0);
        expect(harness.startMcp).not.toHaveBeenCalled();
        expect(harness.watchAppShutdown).not.toHaveBeenCalled();
    });

    it("parks the session when an error brought the application down", async () => {
        const stderrSpy = captureStderr();
        const harness = await startWithDeadApplication("shutDown", new Error("PROBE: initial render throw"));
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
        expect(loggedMessages(harness).some((m) => m.includes(PARKED))).toBe(true);
    });
});

describe("createDevRunner (an application ID another process already owns)", () => {
    it("names the process holding the application ID instead of watching a windowless session", async () => {
        const harness = await startRemoteHarness();
        const messages = loggedMessages(harness);
        expect(messages.some((m) => m.includes("Another process already owns com.example.app"))).toBe(true);
        expect(messages.some((m) => m.includes("HMR enabled"))).toBe(false);
    });

    it("closes the server and exits non-zero rather than running forever", async () => {
        const harness = await startRemoteHarness();
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(1);
    });

    it("leaves the MCP server to the session that owns the application ID", async () => {
        const harness = await startRemoteHarness();
        expect(harness.startMcp).not.toHaveBeenCalled();
        expect(harness.watchAppShutdown).not.toHaveBeenCalled();
    });
});

describe("createDevRunner (application shutdown)", () => {
    it("tears down the server when the application shuts down outside a refresh pass", async () => {
        const harness = await startAppHarness();
        installedShutdown(harness)();
        await settleTimers();
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
        await settleTimers();
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
        expect(loggedMessages(harness).some((m) => m.includes(PARKED))).toBe(true);
    });

    it("keeps the dev server up when the error only arrives after the unmount", async () => {
        const stderrSpy = captureStderr();
        const harness = await startAppHarness();
        installedShutdown(harness)();
        installedUncaughtErrorHandler(harness)(new Error("PROBE: throw inside useEffect"));
        await settleTimers();
        await flushTick();
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
        expect(written).toContain("PROBE: throw inside useEffect");
        expect(loggedMessages(harness).some((m) => m.includes(PARKED))).toBe(true);
    });

    it("maps the reported stack back through the dev server", async () => {
        const stderrSpy = captureStderr();
        const cause = new Error("PROBE: deliberate render throw");
        const harness = await startFailedHarness(cause);
        stderrSpy.mockRestore();
        expect(harness.server.ssrFixStacktrace).toHaveBeenCalledWith(cause);
    });

    it("restarts on the next save so the fixed module is loaded fresh", async () => {
        const stderrSpy = captureStderr();
        const harness = await startFailedHarness(new Error("boom"));
        const loadsBefore = harness.server.ssrLoadModule.mock.calls.length;
        defineModule(harness, "/x/y.ts");
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        stderrSpy.mockRestore();
        expect(harness.server.ssrLoadModule).toHaveBeenCalledTimes(loadsBefore);
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });
});

describe("createDevRunner (an error the application survived)", () => {
    it("keeps Fast Refresh working after an error that left the application up", async () => {
        const stderrSpy = captureStderr();
        const harness = await startAppHarness();
        installedUncaughtErrorHandler(harness)(new Error("PROBE: rejected click handler"));
        await emitBoundaryChange(harness, "/x/y.ts");
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(written).toContain("PROBE: rejected click handler");
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });

    it("still stops the dev runner when the window closes after such an error", async () => {
        const stderrSpy = captureStderr();
        const harness = await startAppHarness();
        installedUncaughtErrorHandler(harness)(new Error("PROBE: rejected click handler"));
        installedShutdown(harness)();
        await settleTimers();
        await flushTick();
        stderrSpy.mockRestore();
        expect(harness.exit).toHaveBeenCalledWith(0);
        expect(loggedMessages(harness).some((m) => m.includes("Application quit"))).toBe(true);
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
        expect(loggedMessages(harness).some((m) => m.includes(PARKED))).toBe(true);
    });

    it("does not claim Fast Refresh is watching a session it has parked", async () => {
        const stderrSpy = captureStderr();
        const harness = await startWithFailingEntry(new Error("boom"));
        stderrSpy.mockRestore();
        expect(loggedMessages(harness).some((m) => m.includes("HMR enabled"))).toBe(false);
    });

    it("stops polling for the application once the entry has failed", async () => {
        const stderrSpy = captureStderr();
        const harness = await startWithFailingEntry(new Error("boom"));
        stderrSpy.mockRestore();
        const [wait] = harness.state.waitCalls;
        expect(wait?.shouldKeepWaiting()).toBe(false);
    });

    it("keeps polling for the application while the entry is healthy", async () => {
        const harness = await startAppHarness();
        const [wait] = harness.state.waitCalls;
        expect(wait?.shouldKeepWaiting()).toBe(true);
    });
});

describe("createDevRunner (an application that died before the runner attached)", () => {
    it("parks the session instead of taking the whole command down", async () => {
        const stderrSpy = captureStderr();
        const cause = new Error("PROBE: initial render throw");
        const harness = await startWithDeadApplication("unregistered", cause);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
        expect(written).toContain("PROBE: initial render throw");
        expect(loggedMessages(harness).some((m) => m.includes(PARKED))).toBe(true);
    });

    it("restarts on the next save instead of Fast Refreshing into a dead application", async () => {
        const stderrSpy = captureStderr();
        const harness = await startWithDeadApplication("unregistered", new Error("boom"));
        defineModule(harness, "/x/y.ts");
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        stderrSpy.mockRestore();
        expect(harness.performRefresh).not.toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });

    it("parks the session when the error struck before any application was mounted", async () => {
        const stderrSpy = captureStderr();
        const cause = new Error("PROBE: throw before the application was created");
        const harness = await startWithDeadApplication("unregistered", cause, null);
        stderrSpy.mockRestore();
        const messages = loggedMessages(harness);
        expect(messages.some((m) => m.includes("Entry did not mount an application"))).toBe(true);
        expect(messages.some((m) => m.includes("HMR enabled"))).toBe(false);
        expect(messages.some((m) => m.includes(PARKED))).toBe(true);
    });
});

describe("createDevRunner (an application that died right after the runner attached)", () => {
    it("parks the session instead of announcing Fast Refresh over a dead application", async () => {
        const stderrSpy = captureStderr();
        const harness = await startDyingAfterAttach(new Error("PROBE: throw inside useEffect"));
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        const messages = loggedMessages(harness);
        expect(messages.some((m) => m.includes("HMR enabled"))).toBe(false);
        expect(messages.some((m) => m.includes(PARKED))).toBe(true);
        expect(written).toContain("PROBE: throw inside useEffect");
    });

    it("restarts on the next save instead of Fast Refreshing a boundary into a dead application", async () => {
        const stderrSpy = captureStderr();
        const harness = await startDyingAfterAttach(new Error("boom"));
        await emitBoundaryChange(harness, "/x/y.ts");
        stderrSpy.mockRestore();
        expect(harness.performRefresh).not.toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });
});

describe("createDevRunner (shutdown outside a refresh pass)", () => {
    it("treats a shutdown after the refresh window has closed as a quit", async () => {
        const harness = await startAppHarness();
        const onShutdown = installedShutdown(harness);
        await emitBoundaryChange(harness, "/x/y.ts");
        await settleTimers();
        onShutdown();
        await settleTimers();
        expect(harness.server.close).toHaveBeenCalled();
        await flushTick();
        expect(harness.exit).toHaveBeenCalledWith(0);
    });

    it("ignores application shutdowns while the runtime is shutting down", async () => {
        const harness = await startAppHarness();
        const onShutdown = installedShutdown(harness);
        onShutdown();
        onShutdown();
        await settleTimers();
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
        await settleTimers();
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
        await startRunner(harness);
        const module = defineModule(harness, "/x/y.ts", { importers: new Set([importerA, importerB]) });
        harness.server.loads.next(() => Promise.resolve({ isBoundary: true }));
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(module);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerA);
        expect(harness.server.moduleGraph.invalidateModule).toHaveBeenCalledWith(importerB);
        expect(harness.performRefresh).toHaveBeenCalled();
    });

    it("requests a full restart via exit(RESTART_EXIT_CODE) when the new module is not a boundary", async () => {
        const harness = buildHarness();
        await startRunner(harness);
        defineModule(harness, "/x/y.ts");
        harness.server.loads.next(() => Promise.resolve({}));
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });

    it("restarts without re-executing when the loaded module is already a non-boundary", async () => {
        const harness = buildHarness();
        await startRunner(harness);
        expect(harness.server.ssrLoadModule).toHaveBeenCalledTimes(1);
        defineModule(harness, "/x/y.ts", { ssrModule: { listviewColorsDemo: {} } });
        await emitChangeAndFlush(harness, "/x/y.ts", 2);
        expect(harness.server.moduleGraph.invalidateModule).not.toHaveBeenCalled();
        expect(harness.server.ssrLoadModule).toHaveBeenCalledTimes(1);
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });
});

describe("createDevRunner (a save the running window cannot receive)", () => {
    it("restarts instead of announcing a Fast Refresh the importers never receive", async () => {
        const save = await saveWatchingStderr({ isBoundary: true, Widget }, { isBoundary: true, Panel });
        expect(save.harness.performRefresh).not.toHaveBeenCalled();
        expectDroppedRefreshRestart(save, DROPPED_EXPORT_REASON);
    });

    it("restarts when an unchanged export name hides a component react-refresh cannot patch", async () => {
        const save = await saveWatchingStderr(
            { isBoundary: true, default: Widget },
            { isBoundary: true, default: Panel },
            { staleExportName: () => "default" },
        );

        expect(save.harness.performRefresh).not.toHaveBeenCalled();
        expectDroppedRefreshRestart(save, RENAMED_COMPONENT_REASON);
    });

    it("fast-refreshes when the module keeps every export its importers hold", async () => {
        const previous = { isBoundary: true, Widget, revision: "before" };
        const next = { isBoundary: true, Widget, revision: "after" };
        const save = await saveWatchingStderr(previous, next);
        expect(save.harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(save.harness.staleExportName).toHaveBeenCalledWith(previous, next);
        expectAnnouncedRefresh(save);
    });

    it("fast-refreshes when the module only adds an export", async () => {
        const save = await saveWatchingStderr({ isBoundary: true, Widget }, { isBoundary: true, Widget, Panel });
        expect(save.harness.performRefresh).toHaveBeenCalledTimes(1);
        expectAnnouncedRefresh(save);
    });

    it("fast-refreshes a re-export the save left patching nothing of its own", async () => {
        const save = await saveWatchingStderr({ isBoundary: true, Widget }, { isBoundary: true, Widget }, {
            performRefresh: patchesNothing,
        });

        expect(save.harness.performRefresh).toHaveBeenCalledTimes(1);
        expectAnnouncedRefresh(save);
    });
});

describe("createDevRunner (the files vite restarts its own dev server for)", () => {
    it("restarts the process when the vite config the server resolved is saved", async () => {
        const harness = await watchServerConfigFile("change", VITE_CONFIG_FILE);
        expectServerConfigRestart(harness, VITE_CONFIG_FILE);
    });

    it("restarts the process when a file the vite config depends on is saved", async () => {
        const harness = await watchServerConfigFile("change", CONFIG_DEPENDENCY_FILE);
        expectServerConfigRestart(harness, CONFIG_DEPENDENCY_FILE);
    });

    it("restarts the process when the env file the server read is saved", async () => {
        const harness = await watchServerConfigFile("change", ENV_FILE);
        expectServerConfigRestart(harness, ENV_FILE);
    });

    it("restarts the process when an env file for the running mode appears", async () => {
        const harness = await watchServerConfigFile("add", MODE_ENV_FILE);
        expectServerConfigRestart(harness, MODE_ENV_FILE);
    });

    it("restarts the process rather than patching a config file the module graph happens to hold", async () => {
        const harness = await watchServerConfigFile("change", VITE_CONFIG_FILE, (started) => {
            defineModule(started, VITE_CONFIG_FILE, { ssrModule: { isBoundary: true } });
        });

        expectServerConfigRestart(harness, VITE_CONFIG_FILE);
        expect(harness.performRefresh).not.toHaveBeenCalled();
    });

    it("leaves an env file for another mode to the module pipeline", async () => {
        const harness = await watchServerConfigFile("change", OTHER_MODE_ENV_FILE);
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });
});

describe("createDevRunner (saves that land while a module is loading)", () => {
    it("reloads the file when a second save lands while its module is still loading", async () => {
        const disk = createFakeDisk("MARKER 1");
        const harness = await startDiskHarness(disk);
        const loads = trackLoadsWithLateSave(harness, disk, "MARKER 2");
        await emitChangeAndSettle(harness, WATCHED_FILE);
        expect(loads).toEqual(["MARKER 1", "MARKER 2"]);
        expect(committedRevision(harness)).toBe(disk.read());
        expect(loggedMessages(harness).filter((m) => m.includes("Fast Refresh complete"))).toHaveLength(1);
    });

    it("collapses a burst of saves for one file into a single serialized pass", async () => {
        const disk = createFakeDisk("MARKER 1");
        const harness = await startDiskHarness(disk);

        for (let save = 0; save < 3; save++) {
            harness.server.watcher.emit("change", WATCHED_FILE);
        }

        await settleQueue();
        expect(harness.server.deduped).toEqual([]);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
    });

    it("warns instead of announcing a Fast Refresh, then commits the revision the next event reports", async () => {
        const stderrSpy = captureStderr();
        const disk = createFakeDisk("MARKER 1");
        const harness = await startDiskHarness(disk);
        const stopSaving = saveOnEveryLoad(harness, disk);
        await emitChangeAndSettle(harness, WATCHED_FILE);
        const written = collectLogged(stderrSpy);
        expect(harness.performRefresh).not.toHaveBeenCalled();
        expect(written).toContain("did not settle in 5 attempts");
        expect(loggedMessages(harness).some((m) => m.includes("Fast Refresh complete"))).toBe(false);
        stopSaving();
        await emitChangeAndSettle(harness, WATCHED_FILE);
        stderrSpy.mockRestore();
        expect(committedRevision(harness)).toBe(disk.read());
        expect(loggedMessages(harness).filter((m) => m.includes("Fast Refresh complete"))).toHaveLength(1);
    });
});

describe("createDevRunner (loads other callers start)", () => {
    it("waits for a load the runner itself started elsewhere instead of joining it", async () => {
        const disk = createFakeDisk("MARKER 1");
        const harness = await startDiskHarness(disk);
        const releaseFirstLoad = holdNextLoad(harness, disk);
        const testingLoad = installedTestingLoader(harness)(WATCHED_FILE);
        disk.write("MARKER 2");
        await emitChangeAndSettle(harness, WATCHED_FILE);
        expect(harness.performRefresh).not.toHaveBeenCalled();
        releaseFirstLoad();
        await testingLoad;
        await settleQueue();
        expect(harness.server.deduped).toEqual([]);
        expect(committedRevision(harness)).toBe("MARKER 2");
        expect(loggedMessages(harness).filter((m) => m.includes("Fast Refresh complete"))).toHaveLength(1);
    });

    it("reloads when a load outside the runner answers with the module from before the invalidation", async () => {
        const disk = createFakeDisk("MARKER 1");
        const harness = await startDiskHarness(disk);
        const releaseForeignLoad = holdNextLoad(harness, disk);
        const foreignLoad = harness.server.ssrLoadModule(WATCHED_FILE);
        disk.write("MARKER 2");
        harness.server.watcher.emit("change", WATCHED_FILE);
        await settleQueue();
        expect(harness.performRefresh).not.toHaveBeenCalled();
        releaseForeignLoad();
        await foreignLoad;
        await settleQueue();
        expect(harness.server.deduped).toEqual([WATCHED_FILE]);
        expect(committedRevision(harness)).toBe("MARKER 2");
        expect(loggedMessages(harness).filter((m) => m.includes("Fast Refresh complete"))).toHaveLength(1);
    });
});

describe("createDevRunner (a revision the runner cannot confirm)", () => {
    it("reports a revision it cannot read instead of committing a module it cannot confirm", async () => {
        const stderrSpy = captureStderr();

        const harness = buildHarness({
            applicationId: "com.example.app",
            readFileRevision: () => Promise.reject(new Error("PROBE: revision read failed")),
        });

        await startRunner(harness);
        defineModule(harness, WATCHED_FILE);
        harness.server.loads.always(() => Promise.resolve({ isBoundary: true }));
        await emitChangeAndSettle(harness, WATCHED_FILE);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(harness.performRefresh).not.toHaveBeenCalled();
        expect(written).toContain("Hot reload failed:");
        expect(written).toContain("PROBE: revision read failed");
        expect(loggedMessages(harness).some((m) => m.includes("Fast Refresh complete"))).toBe(false);
    });
});

describe("createDevRunner (changes queued while the session is shutting down)", () => {
    it("drops queued changes once the session starts shutting down", async () => {
        const harness = await startAppHarness();
        defineModule(harness, WATCHED_FILE);
        shutDownWhileLoading(harness, installedSignalHandler(harness));
        harness.server.watcher.emit("change", WATCHED_FILE);
        harness.server.watcher.emit("change", "/x/queued-after.tsx");
        await settleQueue();
        expect(harness.server.moduleGraph.getModuleById).not.toHaveBeenCalledWith("/x/queued-after.tsx");
    });

    it("stops retrying a file that is still being saved instead of warning during teardown", async () => {
        const stderrSpy = captureStderr();
        const disk = createFakeDisk("MARKER 1");
        const harness = await startDiskHarness(disk);
        const loads = shutDownWhileSaving(harness, disk, installedSignalHandler(harness));
        await emitChangeAndSettle(harness, WATCHED_FILE);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(loads()).toBe(1);
        expect(written).not.toContain("Fast Refresh skipped");
        expect(harness.performRefresh).not.toHaveBeenCalled();
    });

    it("keeps a load that fails because the server closed off stderr", async () => {
        const stderrSpy = captureStderr();
        const harness = await startAppHarness();
        defineModule(harness, WATCHED_FILE);
        const loads = failLoadsWhileShuttingDown(harness, installedSignalHandler(harness));
        await emitChangeAndSettle(harness, WATCHED_FILE);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(loads()).toBe(1);
        expect(written).not.toContain("Hot reload failed");
    });
});

describe("createDevRunner (files that disappear)", () => {
    it("restarts instead of running a module whose source was deleted", async () => {
        const harness = await startAppHarness();
        defineModule(harness, WATCHED_FILE, { ssrModule: { isBoundary: true } });
        await emitWatchEventAndSettle(harness, "unlink", WATCHED_FILE);
        expect(loggedMessages(harness).some((m) => m.includes(`File removed: ${WATCHED_FILE}`))).toBe(true);
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });

    it("ignores a deleted file the module graph never held", async () => {
        const harness = await startAppHarness();
        await emitWatchEventAndSettle(harness, "unlink", "/x/notes.md");
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });

    it("names the close it could not finish and restarts anyway", async () => {
        const harness = buildHarness({ applicationId: "com.example.app" });
        const cause = new Error("PROBE: close refused");
        harness.server.close = vi.fn<DevServer["close"]>(() => Promise.reject(cause));
        const stderrSpy = captureStderr();
        await startRunner(harness);
        defineModule(harness, WATCHED_FILE, { ssrModule: { isBoundary: true } });
        await emitWatchEventAndSettle(harness, "unlink", WATCHED_FILE);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(written).toContain("Error closing server before the restart:");
        expect(written).not.toContain("Hot reload failed");
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });
});

describe("createDevRunner (files that appear)", () => {
    it("applies the save that failed once the file its import asked for appears", async () => {
        const harness = await startWithFailedSave();
        await appearWithBoundaryLoad(harness, MISSING_FILE);
        expect(createdFileLogs(harness)).toEqual([`File created: ${MISSING_FILE}`]);
        expect(retryLogs(harness)).toEqual([`${RETRY_LOG}: ${WATCHED_FILE}`]);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });

    it("applies the save when the file its import asked for arrives as a directory index", async () => {
        const harness = await startWithFailedSave();
        await appearWithBoundaryLoad(harness, MISSING_INDEX_FILE);
        expect(createdFileLogs(harness)).toEqual([`File created: ${MISSING_INDEX_FILE}`]);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
    });

    it("restarts when the save the appearing file unblocks is not a refresh boundary", async () => {
        const harness = await startWithFailedSave();
        harness.server.loads.next(() => Promise.resolve({}));
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(harness.performRefresh).not.toHaveBeenCalled();
        expect(harness.server.close).toHaveBeenCalled();
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });

    it("retries every save that was waiting on the file that appeared", async () => {
        const harness = await startWithTwoFailedSaves();
        harness.server.loads.next(() => Promise.resolve({ isBoundary: true }));
        await appearWithBoundaryLoad(harness, MISSING_FILE);
        expect(retryLogs(harness)).toEqual([`${RETRY_LOG}: ${WATCHED_FILE}`, `${RETRY_LOG}: ${OTHER_IMPORTER}`]);
        expect(harness.performRefresh).toHaveBeenCalledTimes(2);
        expect(harness.exit).not.toHaveBeenCalled();
    });
});

describe("createDevRunner (files that appear while the session is parked)", () => {
    it("restarts a parked session once the file its entry could not load appears", async () => {
        const harness = await startWithMissingEntryImport();
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(createdFileLogs(harness)).toEqual([`File created: ${MISSING_FILE}`]);
        expect(harness.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    });

    it("leaves a parked session parked when a file it never asked for appears", async () => {
        const harness = await startWithMissingEntryImport();
        await emitWatchEventAndSettle(harness, "add", UNRELATED_FILE);
        expect(createdFileLogs(harness)).toEqual([]);
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });

    it("leaves a parked session parked when no appearing file could fix why the entry failed", async () => {
        const stderrSpy = captureStderr();
        const harness = await startWithFailingEntry(new Error("PROBE: entry blew up"));
        stderrSpy.mockRestore();
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(createdFileLogs(harness)).toEqual([]);
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });
});

describe("createDevRunner (files that appear beside a healthy session)", () => {
    it("leaves a healthy session alone when an unrelated file appears", async () => {
        const harness = await startAppHarness();
        await emitBoundaryChange(harness, WATCHED_FILE);
        await emitWatchEventAndSettle(harness, "add", UNRELATED_FILE);
        expect(createdFileLogs(harness)).toEqual([]);
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });

    it("stops holding a save against the session once the same file reloads", async () => {
        const harness = await startWithFailedSave();
        harness.server.loads.next(() => Promise.resolve({ isBoundary: true }));
        await emitChangeAndSettle(harness, WATCHED_FILE);
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(createdFileLogs(harness)).toEqual([]);
        expect(harness.exit).not.toHaveBeenCalled();
    });
});

describe("createDevRunner (saves that never reached the application)", () => {
    it("leaves the failed save alone when a file it never asked for appears", async () => {
        const harness = await startWithFailedSave();
        const loadsBefore = startedLoads(harness);
        const stderrSpy = captureStderr();
        await emitWatchEventAndSettle(harness, "add", UNRELATED_FILE);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(retryLogs(harness)).toEqual([]);
        expect(startedLoads(harness)).toBe(loadsBefore);
        expect(written).toBe("");
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });

    it("still applies that save once the file it did ask for appears", async () => {
        const harness = await startWithFailedSave();
        await emitWatchEventAndSettle(harness, "add", UNRELATED_FILE);
        await appearWithBoundaryLoad(harness, MISSING_FILE);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(harness.exit).not.toHaveBeenCalled();
    });

    it("waits for the next file when the retry names a different missing import", async () => {
        const harness = await startWithFailedSave();
        const written = await appearWithFailingLoad(harness, MISSING_FILE, NEXT_RESOLVE_FAILURE);
        expect(written).toContain(NEXT_RESOLVE_FAILURE);
        await appearWithBoundaryLoad(harness, NEXT_MISSING_FILE);
        expect(retryLogs(harness)).toHaveLength(2);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(harness.exit).not.toHaveBeenCalled();
    });

    it("stops waiting once the retry fails a way no appearing file can fix", async () => {
        const harness = await startWithFailedSave();
        const written = await appearWithFailingLoad(harness, MISSING_FILE, BROKEN_FILE_FAILURE);
        expect(written).toContain("Hot reload failed:");
        expect(written).toContain(BROKEN_FILE_FAILURE);
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(retryLogs(harness)).toHaveLength(1);
        harness.server.loads.next(() => Promise.resolve({ isBoundary: true }));
        await emitChangeAndSettle(harness, WATCHED_FILE);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(harness.exit).not.toHaveBeenCalled();
    });
});

describe("createDevRunner (a save the runner could not settle)", () => {
    it("leaves it to the next save instead of retrying it on every file that appears", async () => {
        const stderrSpy = captureStderr();
        const disk = createFakeDisk("MARKER 1");
        const harness = await startDiskHarness(disk);
        const stopSaving = saveOnEveryLoad(harness, disk);
        await emitChangeAndSettle(harness, WATCHED_FILE);
        const written = collectLogged(stderrSpy);
        stderrSpy.mockRestore();
        expect(written).toContain("did not settle in 5 attempts");
        stopSaving();
        const loadsBefore = startedLoads(harness);
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(retryLogs(harness)).toEqual([]);
        expect(startedLoads(harness)).toBe(loadsBefore);
        await emitChangeAndSettle(harness, WATCHED_FILE);
        expect(harness.performRefresh).toHaveBeenCalledTimes(1);
        expect(committedRevision(harness)).toBe(disk.read());
    });
});

describe("createDevRunner (a retry the appearing file cannot land)", () => {
    it("names the retry instead of claiming the user changed the file the save is waiting on", async () => {
        const harness = await startWithFailedSave();
        await appearWithBoundaryLoad(harness, MISSING_FILE);
        expect(messagesMatching(harness, `File changed: ${WATCHED_FILE}`)).toHaveLength(1);
        expect(messagesMatching(harness, `File changed: ${MISSING_FILE}`)).toEqual([]);
    });

    it("skips the retry when the module the save belongs to left the module graph", async () => {
        const harness = await startWithFailedSave();
        harness.server.modules.delete(WATCHED_FILE);
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(retryLogs(harness)).toEqual([]);
        expect(harness.performRefresh).not.toHaveBeenCalled();
        expect(harness.exit).not.toHaveBeenCalled();
        expect(harness.server.close).not.toHaveBeenCalled();
    });

    it("stops retrying the saves that are left once the session starts shutting down", async () => {
        const harness = await startWithTwoFailedSaves();
        shutDownWhileLoading(harness, installedSignalHandler(harness));
        await emitWatchEventAndSettle(harness, "add", MISSING_FILE);
        expect(retryLogs(harness)).toEqual([`${RETRY_LOG}: ${WATCHED_FILE}`]);
        expect(harness.performRefresh).not.toHaveBeenCalled();
    });
});
