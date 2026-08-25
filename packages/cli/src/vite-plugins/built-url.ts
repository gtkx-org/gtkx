import type { Plugin, UserConfig } from "vite";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { stripQuery } from "./strip-query.js";

type PluginState = { isBuild: boolean };
type WatchContext = { addWatchFile: (file: string) => void };

const URL_QUERY_RE = /\?url(?:&t=\d+)?$/;

const bundleRelativeUrl = (filename: string): string => {
    const specifier = JSON.stringify(`./${filename}`);

    return `decodeURIComponent(new URL(${specifier}, import.meta.url).pathname)`;
};

const renderAssetUrl = (
    filename: string,
    type: string,
): { runtime: string } | undefined => {
    if (type !== "asset") {
        return undefined;
    }

    return { runtime: bundleRelativeUrl(filename) };
};

const configureBuiltUrl = (userConfig: UserConfig, command: string): UserConfig | undefined => {
    if (command !== "build" || userConfig.experimental?.renderBuiltUrl) {
        return undefined;
    }

    return {
        experimental: {
            renderBuiltUrl(filename, { type }) {
                return renderAssetUrl(filename, type);
            },
        },
    };
};

const loadDevFileUrl = (ctx: WatchContext, state: PluginState, id: string): string | undefined => {
    if (state.isBuild || !URL_QUERY_RE.test(id)) {
        return undefined;
    }

    const file = stripQuery(id);

    if (!isAbsolute(file) || !existsSync(file)) {
        return undefined;
    }

    ctx.addWatchFile(file);

    return `export default ${JSON.stringify(file)};`;
};

function gtkxBuiltUrl(): Plugin {
    const state: PluginState = { isBuild: false };

    return {
        name: "gtkx:built-url",
        enforce: "pre",

        config: (userConfig, { command }) => configureBuiltUrl(userConfig, command),

        configResolved(config) {
            state.isBuild = config.command === "build";
        },

        load(id) {
            return loadDevFileUrl(this, state, id);
        },
    };
}

export { gtkxBuiltUrl };
