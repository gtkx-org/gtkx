import type { Plugin } from "vite";
import gtkxVitest, { type PluginOptions } from "@gtkx/vitest";
import { createProjectStaging } from "./internal/project-staging.js";
import { gtkxEnsureStore } from "./vite-plugins/ensure-store.js";
import { gtkxFontWorkerEnv } from "./vite-plugins/font-worker-env.js";
import { gtkxIconWorkerEnv } from "./vite-plugins/icon-worker-env.js";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxRendererLibraries } from "./vite-plugins/renderer-libraries.js";
import { gtkxSettingsWorkerEnv } from "./vite-plugins/settings-worker-env.js";
import { gtkxWorkerPreload } from "./vite-plugins/worker-preload.js";

/**
 * Vite plugin stack for testing a GTKX application: the generated bindings the tests import,
 * the dependencies built against `@gtkx/react`, the plugins the app is built with, the project's
 * compiled GSettings schemas and its configured application icon exposed to every test worker, a
 * headless display per worker, and `?url` imports in the Node workers that tests start.
 *
 * @returns The plugins to spread into a Vitest config.
 */
const gtkx = (options: PluginOptions = {}): Plugin[] => {
    const staging = createProjectStaging();

    return [
        gtkxEnsureStore(options.configFile),
        gtkxRendererLibraries(),
        ...gtkxVitePlugins({ configFile: options.configFile, localeDir: options.localeDir, staging }),
        gtkxSettingsWorkerEnv(staging.schemas, options.configFile),
        gtkxFontWorkerEnv(staging.fonts, options.configFile),
        gtkxIconWorkerEnv(options.configFile),
        gtkxWorkerPreload(),
        gtkxVitest(options),
    ];
};

export default gtkx;
