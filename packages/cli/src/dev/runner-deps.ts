import { loadConfig } from "@gtkx/config";
import * as Gio from "@gtkx/gi/gio";
import { quitApplication } from "@gtkx/runtime";
import { info, installGracefulShutdown } from "@gtkx/utils";
import { createServer } from "vite";
import type { DevRunnerDeps } from "./runner.js";
import { startMcpClient, stopMcpClient } from "../mcp/index.js";
import { setTestingModuleLoader } from "../mcp/testing-loader.js";
import { isRefreshBoundary, performRefresh } from "../refresh-runtime.js";
import { gtkxFastRefresh } from "../vite-plugins/fast-refresh/swc-refresh.js";
import { gtkxVitePlugins } from "../vite-plugins/index.js";
import { gtkxReactDomPrebundle } from "../vite-plugins/react-dom-prebundle.js";

const DEV_MODE = "development";
const APPLICATION_POLL_INTERVAL_MS = 50;

const currentApplicationId = (): string | null => Gio.Application.getDefault()?.applicationId ?? null;

const waitForApplicationId = async (timeoutMs: number): Promise<string | null> => {
    const deadline = Date.now() + timeoutMs;
    let applicationId = currentApplicationId();

    while (applicationId === null && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, APPLICATION_POLL_INTERVAL_MS));
        applicationId = currentApplicationId();
    }

    return applicationId;
};

const defaultDevRunnerDeps = (): DevRunnerDeps => ({
    createServer,
    waitForApplicationId,
    getConfiguredApplicationId: async (root: string) => {
        const loaded = await loadConfig(root, { mode: DEV_MODE });

        return loaded.config.applicationId;
    },
    startMcpClient: (applicationId, loadAppModule) => {
        setTestingModuleLoader(() => loadAppModule("@gtkx/testing") as Promise<typeof import("@gtkx/testing")>);

        return startMcpClient(applicationId);
    },
    stopMcpClient,
    watchApplicationShutdown: (onShutdown) => {
        Gio.Application.getDefault()?.on("shutdown", onShutdown);
    },
    isApplicationRegistered: () => Gio.Application.getDefault()?.getIsRegistered() === true,
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
    plugins: () => [...gtkxVitePlugins(DEV_MODE), ...gtkxFastRefresh(), gtkxReactDomPrebundle()],
    log: info,
    exit: (code: number): never => process.exit(code),
});

export { defaultDevRunnerDeps };
