import { fileURLToPath } from "node:url";
import { type Options as SwcOptions, transform } from "@swc/core";
import type { Plugin } from "vite";
import { REFRESH_REG, REFRESH_RUNTIME_SPECIFIER, REFRESH_SIG, shouldTransformForRefresh } from "./refresh-filter.js";

export function gtkxSwcRefresh(): Plugin {
    return {
        name: "gtkx:swc-refresh",
        enforce: "pre",

        async transform(code, id, transformOptions) {
            if (!shouldTransformForRefresh(id, transformOptions)) {
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

export function gtkxRefreshRuntime(): Plugin {
    return {
        name: "gtkx:refresh-runtime",
        enforce: "post",

        resolveId(id) {
            if (id !== REFRESH_RUNTIME_SPECIFIER) return undefined;
            return fileURLToPath(import.meta.resolve(REFRESH_RUNTIME_SPECIFIER));
        },

        transform(code, id, transformOptions) {
            if (!shouldTransformForRefresh(id, transformOptions)) {
                return;
            }

            if (!code.includes(REFRESH_REG) && !code.includes(REFRESH_SIG)) {
                return;
            }

            const moduleIdJson = JSON.stringify(id);

            const header = `
import { createModuleRegistration as __createModuleRegistration__ } from "${REFRESH_RUNTIME_SPECIFIER}";
const { ${REFRESH_REG}, ${REFRESH_SIG} } = __createModuleRegistration__(${moduleIdJson});
`;

            return {
                code: header + code,
                map: null,
            };
        },
    };
}

export const gtkxFastRefresh = (): Plugin[] => [gtkxSwcRefresh(), gtkxRefreshRuntime()];
