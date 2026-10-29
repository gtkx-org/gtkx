import type { InlineConfig, ModuleNode, Plugin, ViteDevServer } from "vite";
import { error, warn } from "@gtkx/utils";
import { isCatalogSource } from "../i18n/catalogs.js";
import { loadModuleExclusively, withExclusiveLoad } from "../internal/module-loads.js";
import { parseRuntimeImportsIn, sourceLanguage } from "../internal/source-imports.js";
import { projectSchemaFiles, SCHEMA_SUFFIX, stageAndCompileProjectSchemas } from "../settings/schema.js";
import { createStorybookSession, type StorybookSession } from "../storybook/session.js";
import { isUrlSpecifier } from "../vite-plugins/asset-specifier.js";
import { injectedCssId } from "../vite-plugins/css.js";
import { REFRESH_REG } from "../vite-plugins/fast-refresh/refresh-filter.js";
import { REL_SEPARATOR, toVirtualId } from "../vite-plugins/resource-shared.js";
import { stripQuery } from "../vite-plugins/strip-query.js";
import { createChangeQueue, type WatchedChange } from "./change-queue.js";
import { createFailureTracker, type FailureTracker } from "./failure-tracker.js";
import { checkDevCatalogs } from "./locale-dir.js";
import { isMissingImport, missingImportName } from "./missing-import.js";
import { createRefreshTracker, type RefreshTracker } from "./refresh-tracker.js";
import { RESTART_EXIT_CODE } from "./supervisor.js";
import { isRepeatedRegistration } from "./type-registration.js";
import { createDevServerConfig, type DevServerWatchEvent, isServerConfigFile } from "./vite-dev-server.js";

type LoadAppModule = (id: string) => Promise<Record<string, unknown>>;
type ApplicationState = "primary" | "remote" | "shutDown" | "unregistered";

type DevRunnerDeps = {
    createServer(config: InlineConfig): Promise<ViteDevServer>;
    waitForApplicationId(timeoutMs: number, shouldKeepWaiting: () => boolean): Promise<string | null>;
    applicationId: string;
    startMcpClient(applicationId: string, loadAppModule: LoadAppModule): Promise<unknown>;
    stopMcpClient(): void;
    reportApplicationError(cause: unknown): void;
    watchApplicationShutdown(onShutdown: () => void): void;
    watchUncaughtErrors(onUncaughtError: (cause: unknown) => void): void;
    watchWorkerSources(onSource: (path: string) => void): void;
    getApplicationRegistrationState(): ApplicationState;
    installShutdownHandlers(onSignal: () => void | Promise<void>): void;
    quitDefaultApplication(): void;
    performRefresh: () => void;
    isRefreshBoundary(module: Record<string, unknown>): boolean;
    staleExportName(previous: Record<string, unknown>, current: Record<string, unknown>): string | null;
    readFileRevision(path: string): Promise<string>;
    hasWrittenCatalog(path: string): boolean;
    hasUnstagedFontImport(root: string, path: string): boolean;
    deployOutDir: string | undefined;
    plugins(entryPath: string): Plugin[];
    log(message: string): void;
    exit(code: number): never;
};

type DevRunner = {
    run(entryPath: string): Promise<void>;
};

type DevRunnerOptions = {
    storybookConfig?: string | undefined;
};

type ShutdownController = {
    isShuttingDown: () => boolean;
    shutdown: (requestQuit: () => void | Promise<void>) => Promise<void>;
};

type DevSession = {
    server: ViteDevServer;
    deps: DevRunnerDeps;
    controller: ShutdownController;
    refreshTracker: RefreshTracker;
    failure: FailureTracker;
    pendingSaves: Map<string, string>;
    imports: Map<string, Set<string>>;
    registrations: Set<string>;
    schemaFiles: Set<string>;
    workerSources: Set<string>;
    hasPendingSchemaChange: boolean;
    storybook: StorybookSession | undefined;
};

type RefreshPlan = {
    invalidated: Set<ModuleNode>;
    boundaries: Set<ModuleNode>;
};

type RefreshWalk = {
    session: DevSession;
    rejected: ReadonlySet<ModuleNode>;
    visited: Set<ModuleNode>;
    plan: RefreshPlan;
};

type PlanLoad = {
    loaded: Map<ModuleNode, Record<string, unknown>>;
    isSettled: boolean;
};

const APPLICATION_MOUNT_TIMEOUT_MS = 10_000;
const OWNED_ID_EXIT_CODE = 1;
const LOAD_ATTEMPT_LIMIT = 5;
const WATCH_EVENTS: DevServerWatchEvent[] = ["add", "change", "unlink"];
const SKIP_REASON = `did not settle in ${String(LOAD_ATTEMPT_LIMIT)} attempts; save it again to patch the window.`;
const DROPPED_REFRESH = "Fast Refresh dropped";
const SAVE_ACTION = "File changed";
const RETRY_ACTION = "Retrying pending save";
const NONE_REJECTED: ReadonlySet<ModuleNode> = new Set();

const unreportedDetail = (server: ViteDevServer, cause: unknown): unknown =>
    cause instanceof Error && server.config.logger.hasErrorLogged(cause) ? cause.message.split("\n", 1)[0] : cause;

const announceFailure = (server: ViteDevServer, cause: unknown): void => {
    if (cause instanceof Error) {
        server.ssrFixStacktrace(cause);
    }

    error(
        "Application error; keeping the dev server up. Fix the error and save again.",
        unreportedDetail(server, cause),
    );
};

const parkSession = (session: DevSession): void => {
    session.deps.log("Waiting for a change to restart the application...");
};

const requestRestart = async (session: DevSession): Promise<never> => {
    session.deps.log("Full restart (process restart)");

    try {
        await session.server.close();
    } catch (error_) {
        error("Error closing server before the restart:", error_);
    }

    return session.deps.exit(RESTART_EXIT_CODE);
};

const registersComponents = (session: DevSession, module: ModuleNode, rejected: ReadonlySet<ModuleNode>): boolean =>
    module.id !== null && session.registrations.has(module.id) && !rejected.has(module);

const reachesBoundaries = (walk: RefreshWalk, module: ModuleNode): boolean => {
    if (module.importers.size === 0) {
        return false;
    }

    for (const importer of module.importers) {
        if (walk.visited.has(importer)) {
            continue;
        }

        walk.visited.add(importer);
        walk.plan.invalidated.add(importer);

        if (registersComponents(walk.session, importer, walk.rejected)) {
            walk.plan.boundaries.add(importer);
        } else if (!reachesBoundaries(walk, importer)) {
            return false;
        }
    }

    return true;
};

const planPropagation = (
    session: DevSession,
    sources: readonly ModuleNode[],
    rejected: ReadonlySet<ModuleNode>,
): RefreshPlan | null => {
    const walk: RefreshWalk = {
        session,
        rejected,
        visited: new Set(sources),
        plan: { invalidated: new Set(), boundaries: new Set() },
    };

    if (!sources.every((source) => reachesBoundaries(walk, source)) || walk.plan.boundaries.size === 0) {
        return null;
    }

    return walk.plan;
};

const planChange = (session: DevSession, module: ModuleNode): RefreshPlan | null => {
    if (registersComponents(session, module, NONE_REJECTED)) {
        return { invalidated: new Set([module]), boundaries: new Set([module]) };
    }

    const plan = planPropagation(session, [module], NONE_REJECTED);
    plan?.invalidated.add(module);

    return plan;
};

const invalidateModuleAndImporters = (session: DevSession, module: ModuleNode): void => {
    session.server.moduleGraph.invalidateModule(module);

    for (const importer of module.importers) {
        session.server.moduleGraph.invalidateModule(importer);
    }
};

const evaluatedModuleFor = (session: DevSession, changedPath: string): ModuleNode | undefined => {
    const { moduleGraph } = session.server;
    const module = moduleGraph.getModuleById(changedPath);

    if (module?.ssrModule) {
        return module;
    }

    return (
        moduleGraph
            .getModulesByFile(changedPath)
            ?.values()
            .find((variant) => variant.ssrModule !== null) ?? module
    );
};

const isEvaluationCurrent = (session: DevSession, changedPath: string): boolean => {
    const evaluated = evaluatedModuleFor(session, changedPath);

    if (!evaluated?.ssrTransformResult) {
        return false;
    }

    return evaluated.ssrModule !== null;
};

const loadPlan = (session: DevSession, changedPath: string, plan: RefreshPlan): Promise<PlanLoad> =>
    withExclusiveLoad(session.server, async () => {
        const revision = await session.deps.readFileRevision(changedPath);

        for (const module of plan.invalidated) {
            invalidateModuleAndImporters(session, module);
        }

        const loaded: Map<ModuleNode, Record<string, unknown>> = new Map();

        for (const boundary of plan.boundaries) {
            loaded.set(boundary, await session.server.ssrLoadModule(boundary.url));
        }

        const settledRevision = await session.deps.readFileRevision(changedPath);

        return {
            loaded,
            isSettled: settledRevision === revision && isEvaluationCurrent(session, changedPath),
        };
    });

const loadSettledPlan = async (
    session: DevSession,
    changedPath: string,
    plan: RefreshPlan,
): Promise<Map<ModuleNode, Record<string, unknown>> | null> => {
    for (let round = 0; round < LOAD_ATTEMPT_LIMIT && !session.controller.isShuttingDown(); round++) {
        const { loaded, isSettled } = await loadPlan(session, changedPath, plan);

        if (isSettled) {
            return loaded;
        }
    }

    return null;
};

const droppedExportName = (previous: Record<string, unknown>, current: Record<string, unknown>): string | null => {
    const kept = new Set(Object.keys(current));

    for (const name of Object.keys(previous)) {
        if (!kept.has(name)) {
            return name;
        }
    }

    return null;
};

const unpatchedExportReason = (
    session: DevSession,
    previous: Record<string, unknown> | null,
    current: Record<string, unknown> | undefined,
): string | null => {
    if (!previous || !current) {
        return null;
    }

    const dropped = droppedExportName(previous, current);

    if (dropped !== null) {
        return `no longer exports ${dropped}, which its importers still hold`;
    }

    const stale = session.deps.staleExportName(previous, current);

    if (stale === null) {
        return null;
    }

    return `renamed the component it exports as ${stale}, which the window is still rendering`;
};

const rejectedBoundaries = (session: DevSession, loaded: Map<ModuleNode, Record<string, unknown>>): ModuleNode[] =>
    [...loaded].filter(([, moduleExports]) => !session.deps.isRefreshBoundary(moduleExports)).map(([module]) => module);

const completeRefresh = async (session: DevSession, changedPath: string, unpatched: string | null): Promise<void> => {
    if (unpatched !== null) {
        warn(`${DROPPED_REFRESH}: ${changedPath} ${unpatched}`);
        await requestRestart(session);

        return;
    }

    session.pendingSaves.delete(changedPath);
    session.deps.log("Running Fast Refresh...");
    session.deps.performRefresh();
    session.deps.log("Fast Refresh complete");
};

const refreshChangedModule = async (
    session: DevSession,
    changedPath: string,
    changedModule: ModuleNode,
    previous: Record<string, unknown> | null,
): Promise<void> => {
    const rejected: Set<ModuleNode> = new Set();
    let plan = planChange(session, changedModule);

    while (plan !== null) {
        const loaded = await loadSettledPlan(session, changedPath, plan);

        if (session.controller.isShuttingDown()) {
            return;
        }

        if (!loaded) {
            warn(`Fast Refresh skipped: ${changedPath} ${SKIP_REASON}`);

            return;
        }

        const rejectedNow = rejectedBoundaries(session, loaded);

        if (rejectedNow.length === 0) {
            await completeRefresh(
                session,
                changedPath,
                unpatchedExportReason(session, previous, loaded.get(changedModule)),
            );

            return;
        }

        for (const module of rejectedNow) {
            rejected.add(module);
        }

        plan = planPropagation(session, rejectedNow, rejected);
    }

    await requestRestart(session);
};

const applyModuleChange = async (session: DevSession, changedPath: string, action: string): Promise<void> => {
    const module = evaluatedModuleFor(session, changedPath);

    if (!module) {
        return;
    }

    session.deps.log(`${action}: ${changedPath}`);

    if (session.failure.isDown()) {
        await requestRestart(session);

        return;
    }

    await refreshChangedModule(session, changedPath, module, module.ssrModule ?? null);
};

const replaceStylesheet = async (session: DevSession, changedPath: string, stylesheet: ModuleNode): Promise<void> => {
    session.deps.log(`Stylesheet changed: ${changedPath}`);

    if (session.failure.isDown()) {
        await requestRestart(session);

        return;
    }

    try {
        await withExclusiveLoad(session.server, async () => {
            session.server.moduleGraph.invalidateModule(stylesheet);
            await session.server.ssrLoadModule(stylesheet.url);
        });
    } catch (error_) {
        error("Hot reload failed:", unreportedDetail(session.server, error_));
    }
};

const awaitMissingImport = (session: DevSession, changedPath: string, cause: unknown): void => {
    const missingName = missingImportName(cause);

    if (missingName === null) {
        session.pendingSaves.delete(changedPath);

        return;
    }

    session.pendingSaves.set(changedPath, missingName);
};

const restartForRegistration = async (session: DevSession, changedPath: string): Promise<void> => {
    session.deps.log(`Registered GObject type changed: ${changedPath}`);
    await requestRestart(session);
};

const applySave = async (session: DevSession, changedPath: string, action: string): Promise<void> => {
    try {
        await applyModuleChange(session, changedPath, action);
    } catch (error_) {
        if (session.controller.isShuttingDown()) {
            return;
        }

        if (isRepeatedRegistration(error_)) {
            await restartForRegistration(session, changedPath);

            return;
        }

        awaitMissingImport(session, changedPath, error_);
        error("Hot reload failed:", unreportedDetail(session.server, error_));
    }
};

const savesAwaiting = (session: DevSession, createdPath: string): string[] =>
    [...session.pendingSaves]
        .filter(([, missingName]) => isMissingImport(createdPath, missingName))
        .map(([changedPath]) => changedPath);

const retryPendingSaves = async (session: DevSession, waiting: string[]): Promise<void> => {
    for (const changedPath of waiting) {
        if (session.controller.isShuttingDown()) {
            return;
        }

        session.pendingSaves.delete(changedPath);
        await applySave(session, changedPath, RETRY_ACTION);
    }
};

const handleFileCreate = async (session: DevSession, createdPath: string): Promise<void> => {
    const waiting = savesAwaiting(session, createdPath);

    if (waiting.length === 0) {
        return;
    }

    session.deps.log(`File created: ${createdPath}`);

    if (session.failure.isDown()) {
        await requestRestart(session);

        return;
    }

    await retryPendingSaves(session, waiting);
};

const handleFileRemove = async (session: DevSession, removedPath: string): Promise<void> => {
    if (!session.server.moduleGraph.getModuleById(removedPath)) {
        return;
    }

    session.deps.log(`File removed: ${removedPath}`);
    await requestRestart(session);
};

const createShutdownController = (server: ViteDevServer, deps: DevRunnerDeps): ShutdownController => {
    let isShuttingDown = false;

    return {
        isShuttingDown: () => isShuttingDown,
        shutdown: async (requestQuit: () => void | Promise<void>): Promise<void> => {
            if (isShuttingDown) {
                return;
            }

            isShuttingDown = true;
            await requestQuit();
            deps.stopMcpClient();
            await server.close();
        },
    };
};

const restartForServerConfig = async (session: DevSession, changedPath: string): Promise<void> => {
    session.deps.log(`Server config changed: ${changedPath}`);
    await requestRestart(session);
};

const restartForFont = async (session: DevSession, changedPath: string): Promise<void> => {
    session.deps.log(`Font import added: ${changedPath}`);
    await requestRestart(session);
};

const restartForCatalog = async (session: DevSession, changedPath: string): Promise<void> => {
    if (session.deps.hasWrittenCatalog(changedPath)) {
        return;
    }

    session.deps.log(`Translation catalog changed: ${changedPath}`);

    try {
        await checkDevCatalogs(session.server.config.root, session.deps.applicationId);
    } catch (error_) {
        error("Translation catalogs failed; keeping the current application.", error_);

        return;
    }

    await requestRestart(session);
};

const restartForSchema = async (session: DevSession): Promise<void> => {
    try {
        stageAndCompileProjectSchemas(session.server.config.root);
    } catch (error_) {
        error("Schema compilation failed; keeping the current application.", error_);

        return;
    }

    await requestRestart(session);
};

const hasChangedSchemaInputs = (session: DevSession, change: WatchedChange): boolean => {
    const isSchemaFile = change.path.endsWith(SCHEMA_SUFFIX);

    if (!isSchemaFile && sourceLanguage(change.path) === undefined) {
        return false;
    }

    const { files, isComplete } = projectSchemaFiles(session.server.config.root);

    if (isSchemaFile && (session.schemaFiles.has(change.path) || files.includes(change.path))) {
        session.hasPendingSchemaChange = true;
    }

    return (
        isComplete &&
        (session.hasPendingSchemaChange || new Set(files).symmetricDifference(session.schemaFiles).size > 0)
    );
};

const didRestartForWorker = async (session: DevSession, change: WatchedChange): Promise<boolean> => {
    if (!session.workerSources.has(change.path)) {
        return false;
    }

    session.deps.log(`Worker module ${change.event}: ${change.path}`);
    await requestRestart(session);

    return true;
};

const loadedStylesheetFor = (session: DevSession, path: string): ModuleNode | undefined => {
    const stylesheet = session.server.moduleGraph.getModuleById(injectedCssId(path));

    return stylesheet?.ssrModule ? stylesheet : undefined;
};

const hasLoadedFileModule = (session: DevSession, path: string): boolean =>
    session.server.moduleGraph
        .getModulesByFile(path)
        ?.values()
        .some((module) => module.ssrModule !== null) ?? false;

const didRestartForStylesheet = async (session: DevSession, change: WatchedChange): Promise<boolean> => {
    if (change.event === "change" || !loadedStylesheetFor(session, change.path)) {
        return false;
    }

    session.deps.log(`Stylesheet ${change.event}: ${change.path}`);
    await requestRestart(session);

    return true;
};

const didRestartForAsset = async (session: DevSession, change: WatchedChange): Promise<boolean> => {
    const fileModules = session.server.moduleGraph.getModulesByFile(change.path);
    const resourcePrefix = toVirtualId(change.path) + REL_SEPARATOR;
    const isResource = session.server.moduleGraph.idToModuleMap.keys().some((id) => id.startsWith(resourcePrefix));

    if (isResource || fileModules?.values().some((module) => module.id !== null && isUrlSpecifier(module.id))) {
        session.deps.log(`Asset ${change.event}: ${change.path}`);
        await requestRestart(session);

        return true;
    }

    return false;
};

const didRestartForImports = async (session: DevSession, path: string): Promise<boolean> => {
    const previous = session.imports.get(path);
    const current = previous === undefined ? null : parseRuntimeImportsIn(path);

    if (previous === undefined || current === null) {
        return false;
    }

    const specifiers = new Set(current.map((entry) => entry.source));

    if (previous.symmetricDifference(specifiers).size === 0) {
        return false;
    }

    session.deps.log(`Module imports changed: ${path}`);
    await requestRestart(session);

    return true;
};

const didRestartForChange = async (session: DevSession, change: WatchedChange): Promise<boolean> => {
    const { root } = session.server.config;

    if (hasChangedSchemaInputs(session, change)) {
        await restartForSchema(session);

        return true;
    }

    if (isCatalogSource(root, change.path)) {
        await restartForCatalog(session, change.path);

        return true;
    }

    if (isServerConfigFile(session.server.config, change.path)) {
        await restartForServerConfig(session, change.path);

        return true;
    }

    if (change.event !== "unlink" && session.deps.hasUnstagedFontImport(root, change.path)) {
        await restartForFont(session, change.path);

        return true;
    }

    return (
        (await didRestartForWorker(session, change)) ||
        (await didRestartForStylesheet(session, change)) ||
        (await didRestartForAsset(session, change)) ||
        didRestartForImports(session, change.path)
    );
};

const applyChange = async (session: DevSession, change: WatchedChange): Promise<void> => {
    if (session.controller.isShuttingDown() || (await didRestartForChange(session, change))) {
        return;
    }

    const hasUpdatedStories = await session.storybook?.handleChange(change);

    if (change.event === "add") {
        await handleFileCreate(session, change.path);

        return;
    }

    if (hasUpdatedStories) {
        return;
    }

    if (change.event === "unlink") {
        await handleFileRemove(session, change.path);

        return;
    }

    const stylesheet = loadedStylesheetFor(session, change.path);

    if (!stylesheet || hasLoadedFileModule(session, change.path)) {
        await applySave(session, change.path, SAVE_ACTION);
    }

    if (stylesheet) {
        await replaceStylesheet(session, change.path, stylesheet);
    }
};

const watchProjectFiles = (session: DevSession): void => {
    const queue = createChangeQueue((change) => applyChange(session, change));

    for (const event of WATCH_EVENTS) {
        session.server.watcher.on(event, (path: string) => {
            queue.enqueue({ event, path });
        });
    }
};

const onShutdownSignal =
    (session: DevSession): (() => Promise<void>) =>
    async () => {
        if (session.controller.isShuttingDown()) {
            return;
        }

        session.deps.log("Received shutdown signal - stopping dev runner...");

        await session.controller.shutdown(() => {
            session.deps.quitDefaultApplication();
        });
    };

const closeAndExit = async (session: DevSession, code = 0): Promise<never> => {
    try {
        await session.controller.shutdown((): void => undefined);
    } catch (error_) {
        error("Error closing server:", error_);

        return session.deps.exit(1);
    }

    return session.deps.exit(code);
};

const isSessionInactive = (session: DevSession): boolean => {
    if (session.controller.isShuttingDown()) {
        return true;
    }

    if (!session.failure.isDown()) {
        return false;
    }

    parkSession(session);

    return true;
};

const stopForApplicationQuit = (session: DevSession): Promise<never> => {
    session.deps.log("Application quit - stopping dev runner...");

    return closeAndExit(session, process.exitCode === undefined ? 0 : Number(process.exitCode));
};

const settleUnmount = (session: DevSession, wasRefreshing: boolean): void => {
    if (isSessionInactive(session)) {
        return;
    }

    if (!wasRefreshing) {
        void stopForApplicationQuit(session);

        return;
    }

    session.deps.log("Application unmounted during Fast Refresh - restarting dev runner...");
    session.deps.exit(RESTART_EXIT_CODE);
};

const handleApplicationShutdown = (session: DevSession): void => {
    if (isSessionInactive(session)) {
        return;
    }

    const wasRefreshing = session.refreshTracker.isRefreshing();

    session.failure.settleUnmount(() => {
        settleUnmount(session, wasRefreshing);
    });
};

const onApplicationShutdown =
    (session: DevSession): (() => void) =>
    () => {
        handleApplicationShutdown(session);
    };

const refusedExitCode = (): number => (process.exitCode === undefined ? 1 : Number(process.exitCode));

const connectApplication = async (session: DevSession): Promise<void> => {
    const { deps, server } = session;
    const { applicationId } = deps;
    deps.log(`Connected application ID: ${applicationId}`);
    await deps.startMcpClient(applicationId, (id) => loadModuleExclusively(server, id));
};

const stopForStoppedApplication = async (session: DevSession, registrationState: ApplicationState): Promise<void> => {
    if (session.failure.hasReported()) {
        session.deps.log("Application stopped before the dev runner attached.");
        session.failure.fail();

        return;
    }

    if (registrationState === "shutDown") {
        await stopForApplicationQuit(session);

        return;
    }

    session.deps.log("Application refused its command line - stopping dev runner...");
    await closeAndExit(session, refusedExitCode());
};

const connectLiveApplication = async (session: DevSession): Promise<void> => {
    const registrationState = session.deps.getApplicationRegistrationState();

    if (registrationState === "primary") {
        await connectApplication(session);

        return;
    }

    if (registrationState === "remote") {
        await closeAndExit(session, OWNED_ID_EXIT_CODE);

        return;
    }

    await stopForStoppedApplication(session, registrationState);
};

const attachApplication = async (session: DevSession): Promise<void> => {
    const { deps, failure } = session;

    const liveApplicationId = await deps.waitForApplicationId(APPLICATION_MOUNT_TIMEOUT_MS, () => !failure.isDown());

    if (failure.isDown()) {
        return;
    }

    if (liveApplicationId === null) {
        deps.log("Entry did not mount an application - MCP client not started.");

        return;
    }

    await connectLiveApplication(session);
};

const loadEntry = async (
    session: DevSession,
    entryPath: string,
    storybookConfig: string | undefined,
): Promise<void> => {
    session.deps.log(`Loading entry: ${entryPath}`);

    try {
        const entry = await loadModuleExclusively(session.server, entryPath);
        if (storybookConfig !== undefined) {
            session.storybook = createStorybookSession(session.server, entry, storybookConfig, {
                isRefreshBoundary: (module) => session.deps.isRefreshBoundary(module),
                restartForRegistration: (changedPath) => restartForRegistration(session, changedPath),
            });
            await session.storybook.initialize();
        }
    } catch (error_) {
        if (session.controller.isShuttingDown()) {
            session.failure.fail();

            return;
        }

        awaitMissingImport(session, entryPath, error_);
        session.failure.fail(error_);
    }
};

const hasApplicationStopped = (registrationState: ApplicationState): boolean =>
    registrationState === "shutDown" || registrationState === "unregistered";

const isApplicationLost = (session: DevSession): boolean =>
    session.failure.hasReported() && hasApplicationStopped(session.deps.getApplicationRegistrationState());

const announceReady = (session: DevSession): void => {
    if (isApplicationLost(session)) {
        session.failure.fail();
    }

    if (isSessionInactive(session)) {
        return;
    }

    session.deps.log("HMR enabled - watching for changes...");
};

const trackModuleImports = (imports: Map<string, Set<string>>): Plugin => ({
    name: "gtkx:dev-imports",
    enforce: "pre",
    transform(_code, id) {
        const path = stripQuery(id);

        if (!imports.has(path) && sourceLanguage(path) !== undefined) {
            const entries = parseRuntimeImportsIn(path);

            if (entries !== null) {
                imports.set(path, new Set(entries.map((entry) => entry.source)));
            }
        }
    },
});

const trackRefreshRegistrations = (registrations: Set<string>): Plugin => ({
    name: "gtkx:dev-refresh-registrations",
    transform(code, id) {
        if (code.includes(REFRESH_REG)) {
            registrations.add(id);
        } else {
            registrations.delete(id);
        }
    },
});

const createSession = (
    server: ViteDevServer,
    deps: DevRunnerDeps,
    imports: Map<string, Set<string>>,
    registrations: Set<string>,
): DevSession => {
    const refreshTracker = createRefreshTracker(deps.performRefresh);

    return {
        server,
        deps: { ...deps, performRefresh: refreshTracker.performRefresh },
        controller: createShutdownController(server, deps),
        refreshTracker,
        failure: createFailureTracker((cause) => {
            announceFailure(server, cause);
            deps.reportApplicationError(cause);
        }, refreshTracker.isRefreshing),
        pendingSaves: new Map(),
        imports,
        registrations,
        schemaFiles: new Set(projectSchemaFiles(server.config.root).files),
        workerSources: new Set(),
        hasPendingSchemaChange: false,
        storybook: undefined,
    };
};

const createDevRunner = (deps: DevRunnerDeps, options: DevRunnerOptions = {}): DevRunner => ({
    async run(entryPath: string): Promise<void> {
        const imports = new Map<string, Set<string>>();
        const registrations = new Set<string>();
        const server = await deps.createServer(
            createDevServerConfig(process.cwd(), deps.deployOutDir, [
                trackModuleImports(imports),
                ...deps.plugins(entryPath),
                trackRefreshRegistrations(registrations),
            ]),
        );
        const session = createSession(server, deps, imports, registrations);
        deps.installShutdownHandlers(onShutdownSignal(session));

        deps.watchUncaughtErrors((cause) => {
            session.failure.report(cause);
        });

        deps.watchWorkerSources((path) => {
            session.workerSources.add(path);
        });

        deps.watchApplicationShutdown(onApplicationShutdown(session));
        watchProjectFiles(session);
        await loadEntry(session, entryPath, options.storybookConfig);
        await attachApplication(session);
        announceReady(session);
    },
});

export { type ApplicationState, createDevRunner, type DevRunnerDeps };
