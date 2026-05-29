import gtkxWorker from "@gtkx/vitest";
import type { Plugin } from "vite";
import { gtkxVitePlugins } from "./vite-plugins/index.js";

/**
 * The GTKX Vitest plugin for application test configs.
 *
 * Returns the GTKX core Vite plugins (GSettings, GResource bundling, asset
 * resolution — the same set used by `gtkx dev` and `gtkx build`) followed by
 * the `@gtkx/vitest` worker plugin that spawns a per-worker Xvfb instance and
 * forces the `forks` pool. Vite flattens the returned array, so adding
 * `gtkx()` is all a project needs; `applicationId` is read from
 * `gtkx.config.ts` automatically.
 *
 * @returns The ordered GTKX Vitest plugins.
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * import gtkx from "@gtkx/cli/vitest";
 * import { defineConfig } from "vitest/config";
 *
 * export default defineConfig({
 *   plugins: [gtkx()],
 * });
 * ```
 */
const gtkx = (): Plugin[] => [...gtkxVitePlugins(), gtkxWorker()];

export default gtkx;
