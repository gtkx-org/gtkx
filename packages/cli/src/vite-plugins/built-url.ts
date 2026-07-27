import type { Plugin } from "vite";

const renderAssetUrl = (
    filename: string,
    type: string,
    assetBase: string | undefined,
): { runtime: string } | undefined => {
    if (type !== "asset") {
        return undefined;
    }

    if (assetBase) {
        const executableDir = "require(\"path\").dirname(process.execPath)";

        return {
            runtime:
                `require("path").join(${executableDir},` +
                `${JSON.stringify(assetBase)},${JSON.stringify(filename)})`,
        };
    }

    const filenameLiteral = JSON.stringify(`./${filename}`);

    return {
        runtime: `new URL(${filenameLiteral}, import.meta.url).pathname`,
    };
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
