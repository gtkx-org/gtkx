import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import { info } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetEmitter } from "./asset-emitter.js";
import { prependBanner } from "../internal/banner.js";
import {
    relativeIconPath,
    resolveApplicationIcon,
    type ResolvedApplicationIcon,
} from "../internal/icon-path.js";
import { type ListedFile, listFilesRecursive } from "../internal/list-files.js";

type PluginState = {
    applicationId: string;
    source: ResolvedApplicationIcon;
};

const ICONS_DIR = "icons";

const XDG_ENV_BANNER = [
    "process.env.XDG_DATA_DIRS = [",
    "    decodeURIComponent(new URL(\".\", import.meta.url).pathname),",
    "    process.env.XDG_DATA_DIRS || \"/usr/local/share:/usr/share\",",
    "].join(\":\");",
].join("\n");

const findIconFiles = (state: PluginState): ListedFile[] => {
    if (state.source.kind === "theme") {
        return listFilesRecursive(state.source.path);
    }

    if (state.source.kind === "none") {
        return [];
    }

    return [{
        absPath: state.source.path,
        rel: relativeIconPath(state.applicationId, state.source.path),
    }];
};

const applyUserConfig = async (state: PluginState, config: UserConfig, loadConfig: ConfigLoader): Promise<void> => {
    const { config: gtkxConfig, root } = await loadConfig.load(config.root ?? process.cwd());
    state.applicationId = gtkxConfig.applicationId;
    state.source = resolveApplicationIcon(root, gtkxConfig.applicationId, gtkxConfig.applicationIcon);
};

const emitIcons = (ctx: AssetEmitter, icons: ListedFile[]): void => {
    for (const { absPath, rel } of icons) {
        ctx.emitFile({ type: "asset", fileName: join(ICONS_DIR, rel), source: readFileSync(absPath) });
    }

    if (icons.length > 0) {
        info(`Copied ${String(icons.length)} icon(s) into ${ICONS_DIR}/`);
    }
};

function gtkxIcons(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: PluginState = {
        applicationId: "",
        source: { kind: "none" },
    };

    return {
        name: "gtkx:icons",
        enforce: "pre",
        apply: "build",

        async config(config: UserConfig) {
            await applyUserConfig(state, config, loadConfig);
        },

        outputOptions(options) {
            if (findIconFiles(state).length === 0) {
                return;
            }

            return prependBanner(options, XDG_ENV_BANNER);
        },

        buildEnd() {
            emitIcons(this, findIconFiles(state));
        },
    };
}

export { gtkxIcons };
