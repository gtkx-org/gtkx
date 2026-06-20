import { type Options as SwcOptions, transform } from "@swc/core";
import type { Plugin } from "vite";
import { createRefreshGate, type RefreshFilterOptions } from "../../internal/vite-refresh-shared.js";

export function swcSsrRefresh(options: RefreshFilterOptions = {}): Plugin {
    const gate = createRefreshGate(options);

    return {
        name: "gtkx:swc-ssr-refresh",
        enforce: "pre",

        async transform(code, id, transformOptions) {
            if (!gate(id, transformOptions)) {
                return;
            }

            const isTsx = id.endsWith(".tsx");
            const isTs = id.endsWith(".ts") || isTsx;

            const swcOptions: SwcOptions = {
                filename: id,
                sourceFileName: id,
                sourceMaps: true,
                jsc: {
                    parser: isTs ? { syntax: "typescript", tsx: isTsx } : { syntax: "ecmascript", jsx: true },
                    transform: {
                        react: {
                            runtime: "automatic",
                            development: true,
                            refresh: true,
                        },
                    },
                    target: "es2022",
                },
            };

            const result = await transform(code, swcOptions);

            return result.map === undefined ? { code: result.code } : { code: result.code, map: result.map };
        },
    };
}
