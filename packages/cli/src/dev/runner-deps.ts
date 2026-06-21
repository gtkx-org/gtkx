import { loadResolvedGtkxConfig } from "@gtkx/config";
import { quitApplication } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import type { ApplicationLifecycleModule } from "@gtkx/react";
import { installGracefulShutdown } from "@gtkx/utils";
import { createServer } from "vite";
import { info } from "../internal/log.js";
import { startMcpClient, stopMcpClient } from "../mcp/index.js";
import { setTestingModuleLoader } from "../mcp/testing-loader.js";
import { isReactRefreshBoundary, performRefresh } from "../refresh-runtime.js";
import { gtkxFastRefresh } from "../vite-plugins/fast-refresh/index.js";
import { gtkxVitePlugins } from "../vite-plugins/index.js";
import { gtkxSkipReactDomOptimize } from "../vite-plugins/skip-react-dom-optimize.js";
import type { DevRunnerDeps } from "./runner.js";

export const defaultDevRunnerDeps = (): DevRunnerDeps => ({
    createServer,
    getApplicationId: () => Gio.Application.getDefault()?.applicationId ?? null,
    getConfiguredApplicationId: async (root: string) =>
        (await loadResolvedGtkxConfig(root, { allowMissing: true })).applicationId,
    startMcpClient: (applicationId, loadAppModule) => {
        setTestingModuleLoader(() => loadAppModule("@gtkx/testing") as Promise<typeof import("@gtkx/testing")>);
        return startMcpClient(applicationId);
    },
    stopMcpClient,
    installApplicationLifecycle: async (loadAppModule, onQuit) => {
        const react = (await loadAppModule("@gtkx/react")) as ApplicationLifecycleModule;
        react.setApplicationLifecycle({
            quit: (application) => onQuit(() => react.defaultApplicationLifecycle.quit(application)),
        });
    },
    installShutdownHandlers: (onSignal) => {
        installGracefulShutdown({ onSignal });
    },
    quitDefaultApplication: () => {
        const application = Gio.Application.getDefault();
        if (application) quitApplication(application);
    },
    performRefresh,
    isReactRefreshBoundary,
    plugins: () => [...gtkxVitePlugins(), ...gtkxFastRefresh(), gtkxSkipReactDomOptimize()],
    log: info,
    exit: (code: number): never => process.exit(code),
});
