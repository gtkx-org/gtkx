import { loadResolvedGtkxConfig } from "@gtkx/config";
import { whenStopped } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import { createServer } from "vite";
import { startMcpClient, stopMcpClient } from "../mcp/index.js";
import { setTestingModuleLoader } from "../mcp/testing-loader.js";
import { isReactRefreshBoundary, performRefresh } from "../refresh-runtime.js";
import { gtkxVitePlugins } from "../vite-plugins/index.js";
import { gtkxRefresh } from "../vite-plugins/react-refresh-runtime.js";
import { swcSsrRefresh } from "../vite-plugins/react-refresh-transform.js";
import { gtkxSkipReactDomOptimize } from "../vite-plugins/skip-react-dom-optimize.js";
import type { DevRunnerDeps } from "./runner.js";

/**
 * Production wiring for {@link createDevRunner}.
 *
 * Connects the runner to Vite, the GLib runtime, the MCP client, and the
 * React Fast Refresh runtime. Lives in its own module so that the runner
 * factory file (`runner.ts`) can be imported in unit tests without
 * pulling the GTK FFI bindings into the test process.
 *
 * The gtkx Vite plugins read `gtkx.config.ts` through their own shared
 * loader, so no build-time configuration is threaded through here;
 * `getConfiguredApplicationId` resolves the config separately for the MCP
 * registration identity.
 *
 * @returns The default {@link DevRunnerDeps} used by `main`.
 */
export const defaultDevRunnerDeps = (): DevRunnerDeps => ({
    createServer,
    whenStopped,
    getApplicationId: () => Gio.Application.getDefault()?.applicationId ?? null,
    getConfiguredApplicationId: async (root: string) => (await loadResolvedGtkxConfig(root)).applicationId,
    startMcpClient: (applicationId, loadAppModule) => {
        setTestingModuleLoader(() => loadAppModule("@gtkx/testing") as Promise<typeof import("@gtkx/testing")>);
        return startMcpClient(applicationId);
    },
    stopMcpClient,
    installApplicationTeardown: async (loadAppModule, onTeardown) => {
        const react = (await loadAppModule("@gtkx/react")) as {
            setApplicationTeardown(next: (() => void) | null): void;
            defaultApplicationTeardown(): void;
        };
        react.setApplicationTeardown(() => onTeardown(react.defaultApplicationTeardown));
    },
    performRefresh,
    isReactRefreshBoundary,
    plugins: () => [...gtkxVitePlugins(), swcSsrRefresh(), gtkxRefresh(), gtkxSkipReactDomOptimize()],
    log: (message: string) => console.log(`[gtkx] ${message}`),
    exit: (code: number): never => process.exit(code),
});
