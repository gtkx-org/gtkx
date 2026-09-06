import type { UserConfig } from "vite";
import type { Plugin } from "vitest/config";
import { createConfigLoader } from "@gtkx/config/internal";
import { stageProjectFonts } from "../internal/font-staging.js";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

function gtkxFontWorkerEnv(configFile?: string): Plugin {
    const loadConfig = createConfigLoader({ configFile });

    return {
        name: "gtkx:font-worker-env",
        enforce: "pre",

        async config(config: UserConfig) {
            const loaded = await loadConfig.load(config.root ?? process.cwd());
            const shareDir = stageProjectFonts(loaded.root);

            return {
                test: { env: { XDG_DATA_DIRS: prependXdgDataDir(shareDir, process.env.XDG_DATA_DIRS) } },
            };
        },
    };
}

export { gtkxFontWorkerEnv };
