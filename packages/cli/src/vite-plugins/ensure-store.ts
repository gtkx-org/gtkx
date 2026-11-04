import type { ConfigLoader, LoadConfigOptions } from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";
import { viteProjectRoot } from "@gtkx/config/internal";
import { ensureGenerated } from "../codegen/run-codegen.js";
import { storeGeneration, storeLinkDirs } from "../internal/store-generation.js";

const TEST_MODE = "test";

const gtkxEnsureStore = (
    options: Pick<LoadConfigOptions, "configFile" | "defaultApplicationId">,
    loadConfig: ConfigLoader,
): Plugin => {
    const state = { configKey: "" };

    return {
        name: "gtkx:ensure-store",

        async config(config: UserConfig) {
            const root = viteProjectRoot(config);
            await ensureGenerated(root, { ...options, shouldAnnounce: true, mode: TEST_MODE });
            state.configKey = JSON.stringify((await loadConfig.load(root)).config);
        },

        configureVitest({ project, defineCacheKeyGenerator }) {
            const linkDirs = storeLinkDirs(project.config.root);
            defineCacheKeyGenerator(() => `${storeGeneration(linkDirs)}\n${state.configKey}`);
        },
    };
};

export { gtkxEnsureStore };
