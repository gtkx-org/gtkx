import type { Plugin, UserConfig } from "vite";
import { info } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prependBanner } from "../internal/banner.js";
import { resolveDataDir } from "../internal/data-dir.js";
import { type ListedFile, listFilesRecursive } from "../internal/list-files.js";

const ICONS_DIR = "icons";

const XDG_ENV_BANNER = [
    "process.env.XDG_DATA_DIRS = [",
    "    decodeURIComponent(new URL(\".\", import.meta.url).pathname),",
    "    process.env.XDG_DATA_DIRS || \"/usr/local/share:/usr/share\",",
    "].join(\":\");",
].join("\n");

type PluginState = {
    iconsDir: string | null;
};

const findIconFiles = (iconsDir: string | null): ListedFile[] =>
    iconsDir === null ? [] : listFilesRecursive(iconsDir);

export function gtkxIcons(): Plugin {
    const state: PluginState = {
        iconsDir: null,
    };

    return {
        name: "gtkx:icons",
        enforce: "pre",
        apply: "build",

        config(config: UserConfig) {
            const root = config.root ?? process.cwd();
            const dataDir = resolveDataDir(root);
            state.iconsDir = dataDir === null ? null : join(root, dataDir, ICONS_DIR);
        },

        outputOptions(options) {
            if (findIconFiles(state.iconsDir).length === 0) return;
            return prependBanner(options, XDG_ENV_BANNER);
        },

        buildEnd() {
            const icons = findIconFiles(state.iconsDir);
            for (const { absPath, rel } of icons) {
                this.emitFile({
                    type: "asset",
                    fileName: join(ICONS_DIR, rel),
                    source: readFileSync(absPath),
                });
            }
            if (icons.length > 0) info(`Copied ${icons.length} icon(s) into ${ICONS_DIR}/`);
        },
    };
}
