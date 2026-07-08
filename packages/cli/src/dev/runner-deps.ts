import { loadConfig } from "@gtkx/config";
import { quitApplication } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { info, installGracefulShutdown } from "@gtkx/utils";
import { createServer } from "vite";
import { startMcpClient, stopMcpClient } from "../mcp/index.js";
import { setTestingModuleLoader } from "../mcp/testing-loader.js";
import { isRefreshBoundary, performRefresh } from "../refresh-runtime.js";
import { gtkxFastRefresh } from "../vite-plugins/fast-refresh/swc-refresh.js";
import { gtkxVitePlugins } from "../vite-plugins/index.js";
import { gtkxReactDomPrebundle } from "../vite-plugins/react-dom-prebundle.js";
import type { DevRunnerDeps } from "./runner.js";

const DEV_MODE = "development";

export const defaultDevRunnerDeps = (): DevRunnerDeps => ({
    createServer,
    getApplicationId: () => Gio.Application.getDefault()?.applicationId ?? null,
    getConfiguredApplicationId: async (root: string) =>
        (await loadConfig(root, { mode: DEV_MODE })).config.applicationId,
    startMcpClient: (applicationId, loadAppModule) => {
        setTestingModuleLoader(() => loadAppModule("@gtkx/testing") as Promise<typeof import("@gtkx/testing")>);
        return startMcpClient(applicationId);
    },
    stopMcpClient,
    watchApplicationShutdown: (onShutdown) => {
        Gio.Application.getDefault()?.on("shutdown", onShutdown);
    },
    installShutdownHandlers: (onSignal) => {
        installGracefulShutdown({ onSignal });
    },
    quitDefaultApplication: () => {
        const application = Gio.Application.getDefault();
        if (application) quitApplication(application as Gtk.Application);
    },
    performRefresh,
    isRefreshBoundary,
    plugins: () => [...gtkxVitePlugins(DEV_MODE), ...gtkxFastRefresh(), gtkxReactDomPrebundle()],
    log: info,
    exit: (code: number): never => process.exit(code),
});
