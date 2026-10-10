import type { ConfigLoader } from "@gtkx/config";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import { onExit } from "@gtkx/runtime";
import { info, installGracefulShutdown } from "@gtkx/utils";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import type { ApplicationState, DevRunnerDeps } from "./runner.js";
import { hasUnstagedFontImport } from "../internal/font-staging.js";
import type { ProjectStaging } from "../internal/project-staging.js";
import { startMcpClient, stopMcpClient } from "../mcp/index.js";
import {
    mergeTestingModule,
    setTestingModuleLoader,
    type TestingInternalModule,
    type TestingPublicModule,
} from "../mcp/testing-loader.js";
import { isRefreshBoundary, performRefresh, staleExportName } from "../refresh-runtime.js";
import { gtkxFastRefresh } from "../vite-plugins/fast-refresh/swc-refresh.js";
import { gtkxVitePlugins } from "../vite-plugins/index.js";
import { gtkxReactDomPrebundle } from "../vite-plugins/react-dom-prebundle.js";
import { type CatalogWrites, createCatalogWrites } from "./catalog-writes.js";

type DevRunnerDepsOptions = {
    applicationId: string;
    loadConfig: ConfigLoader;
    mcpSocketPath?: string | undefined;
    staging: ProjectStaging;
    localeDir?: string | null | undefined;
};

const DEV_MODE = "development";
const APPLICATION_POLL_INTERVAL_MS = 50;
const registeredApplications: WeakSet<object> = new WeakSet();

const currentApplicationId = (): string | null => Gio.Application.getDefault()?.applicationId ?? null;

const currentApplicationRegistrationState = (): ApplicationState => {
    const application = Gio.Application.getDefault();

    if (application === null) {
        return "unregistered";
    }

    if (!application.getIsRegistered()) {
        return registeredApplications.has(application) ? "shutDown" : "unregistered";
    }

    registeredApplications.add(application);

    return application.getIsRemote() ? "remote" : "primary";
};

const watchApplicationShutdown = (onShutdown: () => void): void => {
    GObject.ObjectClass.peek(Gio.Application);
    const signalId = GObject.signalLookup("shutdown", Gio.Application);
    const hookId = GObject.signalAddEmissionHook(signalId, 0, (_hint, values) => {
        const application = values[0]?.getObject();

        if (application && application === Gio.Application.getDefault()) {
            registeredApplications.add(application);
            onShutdown();
        }

        return true;
    });

    onExit(() => GObject.signalRemoveEmissionHook(signalId, hookId));
};

const waitForApplicationId = async (timeoutMs: number, shouldKeepWaiting: () => boolean): Promise<string | null> => {
    const deadline = Date.now() + timeoutMs;
    let applicationId = currentApplicationId();

    while (applicationId === null && Date.now() < deadline && shouldKeepWaiting()) {
        await new Promise((resolve) => setTimeout(resolve, APPLICATION_POLL_INTERVAL_MS));
        applicationId = currentApplicationId();
    }

    return applicationId;
};

const readFileRevision = (path: string): Promise<string> => readFile(path, "utf8");

const devPlugins =
    (configFile: string, catalogWrites: CatalogWrites, options: DevRunnerDepsOptions): DevRunnerDeps["plugins"] =>
    (entryPath) => [
        ...gtkxVitePlugins({
            mode: DEV_MODE,
            entryPath,
            configFile,
            loadConfig: options.loadConfig,
            onCatalogsWritten: catalogWrites.record,
            shouldWarnGraduatedFuture: false,
            staging: options.staging,
            localeDir: options.localeDir,
        }),
        ...gtkxFastRefresh(),
        gtkxReactDomPrebundle(),
    ];

const createDevRunnerDeps = (
    configFile: string,
    deployOutDir: string | undefined,
    catalogWrites: CatalogWrites,
    options: DevRunnerDepsOptions,
): DevRunnerDeps => ({
    createServer,
    waitForApplicationId,
    applicationId: options.applicationId,
    startMcpClient: (applicationId, loadAppModule) => {
        setTestingModuleLoader(async () => {
            const [publicApi, internals] = await Promise.all([
                loadAppModule("@gtkx/testing") as Promise<TestingPublicModule>,
                loadAppModule("@gtkx/testing/internal") as Promise<TestingInternalModule>,
            ]);

            return mergeTestingModule(publicApi, internals);
        });

        return startMcpClient(applicationId, options.mcpSocketPath);
    },
    stopMcpClient,
    watchApplicationShutdown,
    watchUncaughtErrors: (onUncaughtError) => {
        process.on("uncaughtException", onUncaughtError);
        process.on("unhandledRejection", onUncaughtError);
    },
    getApplicationRegistrationState: currentApplicationRegistrationState,
    installShutdownHandlers: (onSignal) => {
        installGracefulShutdown({ onSignal });
    },
    quitDefaultApplication: () => {
        const application = Gio.Application.getDefault();

        if (application) {
            application.quit();
        }
    },
    performRefresh,
    isRefreshBoundary,
    staleExportName,
    readFileRevision,
    hasWrittenCatalog: catalogWrites.hasWritten,
    hasUnstagedFontImport: (root, path) => hasUnstagedFontImport(options.staging.fonts, root, path),
    deployOutDir,
    plugins: devPlugins(configFile, catalogWrites, options),
    log: info,
    exit: (code: number): never => process.exit(code),
});

const defaultDevRunnerDeps = (
    configFile: string,
    deployOutDir: string | undefined,
    options: DevRunnerDepsOptions,
): DevRunnerDeps => createDevRunnerDeps(configFile, deployOutDir, createCatalogWrites(), options);

export { defaultDevRunnerDeps };
