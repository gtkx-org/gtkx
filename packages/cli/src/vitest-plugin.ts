import type { Plugin } from "vite";
import gtkxVitest, { type PluginOptions } from "@gtkx/vitest";
import { gtkxEnsureStore } from "./vite-plugins/ensure-store.js";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxSettingsWorkerEnv } from "./vite-plugins/settings-worker-env.js";

/**
 * Vite plugin stack for testing a GTKX application: the generated bindings the tests import,
 * the plugins the app is built with, the project's compiled GSettings schemas exposed to every
 * test worker, and a headless display per worker.
 *
 * @returns The plugins to spread into a Vitest config.
 */
const gtkx = (options: PluginOptions = {}): Plugin[] => [
    gtkxEnsureStore(options.configFile),
    ...gtkxVitePlugins({ configFile: options.configFile }),
    gtkxSettingsWorkerEnv(options.configFile),
    gtkxVitest(options),
];

export default gtkx;
