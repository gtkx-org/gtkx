import type { Plugin, UserConfig } from "vite";
import { viteProjectRoot } from "@gtkx/config/internal";
import { ensureGenerated } from "../codegen/run-codegen.js";

const TEST_MODE = "test";

const gtkxEnsureStore = (configFile?: string): Plugin => ({
    name: "gtkx:ensure-store",

    async config(config: UserConfig) {
        await ensureGenerated(viteProjectRoot(config), { shouldAnnounce: true, mode: TEST_MODE, configFile });
    },
});

export { gtkxEnsureStore };
