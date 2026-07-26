import type { Plugin } from "vite";
import gtkxVitest from "@gtkx/vitest";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxSettingsWorkerEnv } from "./vite-plugins/settings-worker-env.js";

/**
 * Vite plugin factory that assembles the plugins needed to run GTKX apps under Vitest,
 * combining the shared GTKX Vite plugins with the `@gtkx/vitest` test integration.
 *
 * @returns The ordered array of Vite plugins to include in a Vitest configuration.
 */
const gtkx = (): Plugin[] => [...gtkxVitePlugins(), gtkxSettingsWorkerEnv(), gtkxVitest()];
export default gtkx;
