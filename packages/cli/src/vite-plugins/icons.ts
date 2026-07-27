import type { Plugin, UserConfig } from "vite";
import { info } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prependBanner } from "../internal/banner.js";
import { resolveDataDir } from "../internal/data-dir.js";
import { type ListedFile, listFilesRecursive } from "../internal/list-files.js";

type PluginState = {
    iconsDir: string | null;
};

type PluginContext = {
    emitFile: (file: { type: "asset"; fileName: string; source: Buffer }) => void;
};

const ICONS_DIR = "icons";

const XDG_ENV_BANNER = [
    "process.env.XDG_DATA_DIRS = [",
    "    decodeURIComponent(new URL(\".\", import.meta.url).pathname),",
    "    process.env.XDG_DATA_DIRS || \"/usr/local/share:/usr/share\",",
    "].join(\":\");",
].join("\n");

const findIconFiles = (iconsDir: string | null): ListedFile[] =>
    iconsDir === null ? [] : listFilesRecursive(iconsDir);

const resolveIconsDir = (config: UserConfig): string | null => {
    const root = config.root ?? process.cwd();
    const dataDir = resolveDataDir(root);

    return dataDir === null ? null : join(root, dataDir, ICONS_DIR);
};

const emitIcons = (ctx: PluginContext, icons: ListedFile[]): void => {
    for (const { absPath, rel } of icons) {
        ctx.emitFile({ type: "asset", fileName: join(ICONS_DIR, rel), source: readFileSync(absPath) });
    }

    if (icons.length > 0) {
        info(`Copied ${String(icons.length)} icon(s) into ${ICONS_DIR}/`);
    }
};

function gtkxIcons(): Plugin {
    const state: PluginState = {
        iconsDir: null,
    };

    return {
        name: "gtkx:icons",
        enforce: "pre",
        apply: "build",

        config(config: UserConfig) {
            state.iconsDir = resolveIconsDir(config);
        },

        outputOptions(options) {
            if (findIconFiles(state.iconsDir).length === 0) {
                return;
            }

            return prependBanner(options, XDG_ENV_BANNER);
        },

        buildEnd() {
            emitIcons(this, findIconFiles(state.iconsDir));
        },
    };
}

export { gtkxIcons };
