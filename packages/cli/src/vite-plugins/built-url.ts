import type { Plugin } from "vite";
import { posix } from "node:path";

const EXECUTABLE_URL_BASE = "`file://${process.execPath}`";
const LEADING_SLASHES = /^\/+/;

const executableRelativeUrl = (target: string): string => {
    const specifier = JSON.stringify(target.replace(LEADING_SLASHES, "./"));

    return `decodeURIComponent(new URL(${specifier}, ${EXECUTABLE_URL_BASE}).pathname)`;
};

const bundleRelativeUrl = (filename: string): string => {
    const specifier = JSON.stringify(`./${filename}`);

    return `decodeURIComponent(new URL(${specifier}, import.meta.url).pathname)`;
};

const renderAssetUrl = (
    filename: string,
    type: string,
    assetBase: string | undefined,
): { runtime: string } | undefined => {
    if (type !== "asset") {
        return undefined;
    }

    if (assetBase === undefined) {
        return { runtime: bundleRelativeUrl(filename) };
    }

    return { runtime: executableRelativeUrl(posix.join(assetBase, filename)) };
};

function gtkxBuiltUrl(assetBase?: string): Plugin {
    return {
        name: "gtkx:built-url",
        apply: "build",

        config(userConfig) {
            if (userConfig.experimental?.renderBuiltUrl) {
                return;
            }

            return {
                experimental: {
                    renderBuiltUrl(filename, { type }) {
                        return renderAssetUrl(filename, type, assetBase);
                    },
                },
            };
        },
    };
}

export { gtkxBuiltUrl };
