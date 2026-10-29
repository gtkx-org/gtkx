import type { Plugin, UserConfig } from "vite";
import { resolveStore } from "@gtkx/codegen";
import { viteProjectRoot } from "@gtkx/config/internal";
import { existsSync, realpathSync } from "node:fs";
import { ensureGenerated } from "../codegen/run-codegen.js";

const TEST_MODE = "test";

const storeGeneration = (linkDirs: string[]): string =>
    linkDirs.map((linkDir) => (existsSync(linkDir) ? realpathSync(linkDir) : "")).join("\n");

const gtkxEnsureStore = (configFile?: string): Plugin => ({
    name: "gtkx:ensure-store",

    async config(config: UserConfig) {
        await ensureGenerated(viteProjectRoot(config), { shouldAnnounce: true, mode: TEST_MODE, configFile });
    },

    configureVitest({ project, defineCacheKeyGenerator }) {
        const { gi, jsx } = resolveStore(project.config.root);
        const linkDirs = jsx === null ? [gi.linkDir] : [gi.linkDir, jsx.linkDir];
        defineCacheKeyGenerator(() => storeGeneration(linkDirs));
    },
});

export { gtkxEnsureStore };
