import { whenStopped } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import { createServer } from "vite";
import { startMcpClient, stopMcpClient } from "../mcp/index.js";
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
 * The GResource plugin self-loads `applicationId` from `gtkx.config.ts`, so
 * no build-time configuration is threaded through here.
 *
 * @returns The default {@link DevRunnerDeps} used by `main`.
 */
export const defaultDevRunnerDeps = (): DevRunnerDeps => ({
    createServer,
    whenStopped,
    getApplicationId: () => Gio.Application.getDefault()?.applicationId ?? null,
    startMcpClient,
    stopMcpClient,
    performRefresh,
    isReactRefreshBoundary,
    plugins: () => [...gtkxVitePlugins(), swcSsrRefresh(), gtkxRefresh(), gtkxSkipReactDomOptimize()],
    log: (message: string) => console.log(`[gtkx] ${message}`),
    exit: (code: number): never => process.exit(code),
});
