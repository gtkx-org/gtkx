import type { ConfigLoader, LoadConfigOptions } from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";
import { resolveStore } from "@gtkx/codegen";
import { viteProjectRoot } from "@gtkx/config/internal";
import { existsSync, realpathSync } from "node:fs";
import { ensureGenerated } from "../codegen/run-codegen.js";

const TEST_MODE = "test";

const storeGeneration = (linkDirs: string[]): string =>
    linkDirs.map((linkDir) => (existsSync(linkDir) ? realpathSync(linkDir) : "")).join("\n");

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
            const { gi, jsx } = resolveStore(project.config.root);
            const linkDirs = jsx === null ? [gi.linkDir] : [gi.linkDir, jsx.linkDir];
            defineCacheKeyGenerator(() => `${storeGeneration(linkDirs)}\n${state.configKey}`);
        },
    };
};

export { gtkxEnsureStore };
