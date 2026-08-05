import type { Plugin } from "vite";
import gtkxVitest from "@gtkx/vitest";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxSettingsWorkerEnv } from "./vite-plugins/settings-worker-env.js";

/**
 * Vite plugin stack for testing a GTKX application: the plugins the app is built with, the
 * project's compiled GSettings schemas exposed to every test worker, and a headless display
 * per worker.
 *
 * @returns The plugins to spread into a Vitest config.
 */
const gtkx = (): Plugin[] => [...gtkxVitePlugins(), gtkxSettingsWorkerEnv(), gtkxVitest()];

export default gtkx;
