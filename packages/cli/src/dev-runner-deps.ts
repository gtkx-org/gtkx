import { dirname } from "node:path";
import { whenStopped } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import { createServer } from "vite";
import { loadApplicationId } from "./codegen/config-loader.js";
import type { DevRunnerDeps } from "./dev-runner.js";
import { startMcpClient, stopMcpClient } from "./mcp/index.js";
import { isReactRefreshBoundary, performRefresh } from "./refresh-runtime.js";
import { gtkxAssets } from "./vite-plugins/assets.js";
import { gtkxResources } from "./vite-plugins/gresources.js";
import { gtkxGSettings } from "./vite-plugins/gsettings.js";
import { gtkxRefresh } from "./vite-plugins/react-refresh-runtime.js";
import { swcSsrRefresh } from "./vite-plugins/react-refresh-transform.js";
import { gtkxSkipReactDomOptimize } from "./vite-plugins/skip-react-dom-optimize.js";

/**
 * Production wiring for {@link createDevRunner}.
 *
 * Connects the runner to Vite, the GLib runtime, the MCP client, and the
 * React Fast Refresh runtime. Lives in its own module so that the runner
 * factory file (`dev-runner.ts`) can be imported in unit tests without
 * pulling the GTK FFI bindings into the test process.
 *
 * Reads `applicationId` from `gtkx.config.ts` (if present) so the
 * GResource pipeline and `import.meta.env.GTKX_APP_ID` line up with the
 * production build.
 *
 * @param cwd - Working directory; used to resolve `gtkx.config.ts`.
 * @param entryPath - Absolute path to the application entry. Its
 *     directory becomes the GResource `sourceRoot` so bundle paths
 *     align with GApplication's default `resource_base_path`.
 * @returns The default {@link DevRunnerDeps} used by `main`.
 */
export const defaultDevRunnerDeps = async (cwd: string, entryPath: string): Promise<DevRunnerDeps> => {
    const applicationId = await loadApplicationId(cwd);
    const sourceRoot = dirname(entryPath);
    return {
        createServer,
        whenStopped,
        getApplicationId: () => Gio.Application.getDefault()?.applicationId ?? null,
        startMcpClient,
        stopMcpClient,
        performRefresh,
        isReactRefreshBoundary,
        plugins: () => [
            gtkxGSettings(),
            gtkxResources({ applicationId, sourceRoot }),
            gtkxAssets(),
            swcSsrRefresh(),
            gtkxRefresh(),
            gtkxSkipReactDomOptimize(),
        ],
        define: () => ({
            "import.meta.env.GTKX_APP_ID": JSON.stringify(applicationId ?? ""),
        }),
        log: (message: string) => console.log(`[gtkx] ${message}`),
        exit: (code: number): never => process.exit(code),
    };
};
