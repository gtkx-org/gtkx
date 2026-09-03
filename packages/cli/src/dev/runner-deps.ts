import { loadConfig } from "@gtkx/config";
import * as Gio from "@gtkx/gi/gio";
import { quitApplication } from "@gtkx/runtime";
import { type ApplicationInstance, getApplicationInstance } from "@gtkx/runtime/internal";
import { info, installGracefulShutdown } from "@gtkx/utils";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import type { DevRunnerDeps } from "./runner.js";
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

const DEV_MODE = "development";
const APPLICATION_POLL_INTERVAL_MS = 50;

const currentApplicationId = (): string | null => Gio.Application.getDefault()?.applicationId ?? null;

const currentApplicationInstance = (): ApplicationInstance => {
    const application = Gio.Application.getDefault();

    return application === null ? "unregistered" : getApplicationInstance(application);
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

const defaultDevRunnerDeps = (configFile: string): DevRunnerDeps => ({
    createServer,
    waitForApplicationId,
    getConfiguredApplicationId: async (root: string) => {
        const loaded = await loadConfig(root, { mode: DEV_MODE, configFile });

        return loaded.config.applicationId;
    },
    startMcpClient: (applicationId, loadAppModule) => {
        setTestingModuleLoader(async () => {
            const [publicApi, internals] = await Promise.all([
                loadAppModule("@gtkx/testing") as Promise<TestingPublicModule>,
                loadAppModule("@gtkx/testing/internal") as Promise<TestingInternalModule>,
            ]);

            return mergeTestingModule(publicApi, internals);
        });

        return startMcpClient(applicationId);
    },
    stopMcpClient,
    watchApplicationShutdown: (onShutdown) => {
        Gio.Application.getDefault()?.on("shutdown", onShutdown);
    },
    watchUncaughtErrors: (onUncaughtError) => {
        process.on("uncaughtException", onUncaughtError);
        process.on("unhandledRejection", onUncaughtError);
    },
    getApplicationInstance: currentApplicationInstance,
    installShutdownHandlers: (onSignal) => {
        installGracefulShutdown({ onSignal });
    },
    quitDefaultApplication: () => {
        const application = Gio.Application.getDefault();

        if (application) {
            quitApplication(application);
        }
    },
    performRefresh,
    isRefreshBoundary,
    staleExportName,
    readFileRevision,
    plugins: (entryPath) => [
        ...gtkxVitePlugins({ mode: DEV_MODE, entryPath, configFile }),
        ...gtkxFastRefresh(),
        gtkxReactDomPrebundle(),
    ],
    log: info,
    exit: (code: number): never => process.exit(code),
});

export { defaultDevRunnerDeps };
