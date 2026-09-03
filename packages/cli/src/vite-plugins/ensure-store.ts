import type { Plugin } from "vite";
import { ensureGenerated } from "../codegen/run-codegen.js";

const TEST_MODE = "test";

const gtkxEnsureStore = (configFile?: string): Plugin => ({
    name: "gtkx:ensure-store",

    async config() {
        await ensureGenerated(process.cwd(), { shouldAnnounce: true, mode: TEST_MODE, configFile });
    },
});

export { gtkxEnsureStore };
