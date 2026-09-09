import type { UserConfig } from "vite";
import type { Plugin } from "vitest/config";
import { createConfigLoader, viteProjectRoot } from "@gtkx/config/internal";
import { stageProjectIcons } from "../internal/icon-staging.js";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

function gtkxIconWorkerEnv(configFile?: string): Plugin {
    const loadConfig = createConfigLoader({ configFile });

    return {
        name: "gtkx:icon-worker-env",
        enforce: "pre",

        async config(config: UserConfig) {
            const loaded = await loadConfig.load(viteProjectRoot(config));

            const shareDir = stageProjectIcons(
                loaded.root,
                loaded.config.applicationId,
                loaded.config.applicationIcon,
            );

            if (shareDir === null) {
                return;
            }

            const existing = config.test?.env?.XDG_DATA_DIRS ?? process.env.XDG_DATA_DIRS;

            return {
                test: { env: { XDG_DATA_DIRS: prependXdgDataDir(shareDir, existing) } },
            };
        },
    };
}

export { gtkxIconWorkerEnv };
