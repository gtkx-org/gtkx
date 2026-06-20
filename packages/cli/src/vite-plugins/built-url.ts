import type { Plugin } from "vite";

export function gtkxBuiltUrl(assetBase?: string): Plugin {
    return {
        name: "gtkx:built-url",

        config(userConfig) {
            if (userConfig.experimental?.renderBuiltUrl) {
                return;
            }

            return {
                experimental: {
                    renderBuiltUrl(filename, { type }) {
                        if (type !== "asset") {
                            return;
                        }

                        if (assetBase) {
                            return {
                                runtime: `require("path").join(require("path").dirname(process.execPath),${JSON.stringify(assetBase)},${JSON.stringify(filename)})`,
                            };
                        }

                        const filenameLiteral = JSON.stringify(`./${filename}`);
                        return {
                            runtime: `new URL(${filenameLiteral}, import.meta.url).pathname`,
                        };
                    },
                },
            };
        },
    };
}
