import type { Plugin } from "vite";

/**
 * Vite plugin that configures `renderBuiltUrl` for resolving asset imports
 * to filesystem paths at runtime.
 *
 * When `assetBase` is provided, assets resolve relative to the executable
 * directory using `path.join(path.dirname(process.execPath), assetBase, filename)`.
 * This supports FHS-compliant layouts where assets live in `../share/<app>/`.
 *
 * When `assetBase` is omitted, assets resolve relative to the bundle file
 * via `import.meta.url`, which works when assets are co-located with the
 * executable.
 *
 * Only applies when the user has not already configured
 * `experimental.renderBuiltUrl` in their Vite config.
 */
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
