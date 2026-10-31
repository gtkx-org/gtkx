import type { Plugin } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import gtkxVitest, { type PluginOptions } from "@gtkx/vitest";
import { createProjectStaging } from "./internal/project-staging.js";
import { gtkxEnsureStore } from "./vite-plugins/ensure-store.js";
import { gtkxFontWorkerEnv } from "./vite-plugins/font-worker-env.js";
import { gtkxIconWorkerEnv } from "./vite-plugins/icon-worker-env.js";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxRendererLibraries } from "./vite-plugins/renderer-libraries.js";
import { gtkxSettingsWorkerEnv } from "./vite-plugins/settings-worker-env.js";
import { gtkxWorkerPreload } from "./vite-plugins/worker-preload.js";

const TEST_APPLICATION_ID = "org.gtkx.Test";

/**
 * Vite plugin stack for testing a GTKX application: the generated bindings the tests import,
 * the dependencies built against `@gtkx/react`, the plugins the app is built with, the project's
 * compiled GSettings schemas and its configured application icon exposed to every test worker, a
 * headless display per worker, and `?url` imports in the Node workers that tests start.
 *
 * A package that is not an application, such as a component library, needs no `gtkx.config.ts`: without
 * one, or without an `applicationId` in it, the tests run as the application `org.gtkx.Test`.
 *
 * @returns The plugins to spread into a Vitest config.
 */
const gtkx = (options: PluginOptions = {}): Plugin[] => {
    const staging = createProjectStaging();
    const configOptions = { configFile: options.configFile, defaultApplicationId: TEST_APPLICATION_ID };
    const loadConfig = createConfigLoader(configOptions);

    return [
        gtkxEnsureStore(configOptions),
        gtkxRendererLibraries(),
        ...gtkxVitePlugins({ loadConfig, localeDir: options.localeDir, staging }),
        gtkxSettingsWorkerEnv(staging.schemas, loadConfig),
        gtkxFontWorkerEnv(staging.fonts, loadConfig),
        gtkxIconWorkerEnv(loadConfig),
        gtkxWorkerPreload(),
        gtkxVitest(options),
    ];
};

export default gtkx;
