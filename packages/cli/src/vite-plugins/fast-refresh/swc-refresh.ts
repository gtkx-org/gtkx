import type { Plugin } from "vite";
import { type Output, type Options as SwcOptions, transform } from "@swc/core";
import { fileURLToPath } from "node:url";
import { REFRESH_REG, REFRESH_RUNTIME_SPECIFIER, REFRESH_SIG, shouldTransformForRefresh } from "./refresh-filter.js";

const buildSwcOptions = (id: string): SwcOptions => {
    const isTsx = id.endsWith(".tsx");
    const isTs = id.endsWith(".ts") || isTsx;

    return {
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
};

const buildRefreshResult = (result: Output): { code: string; map?: string } =>
    result.map === undefined ? { code: result.code } : { code: result.code, map: result.map };

const injectRefreshRegistration = (
    code: string,
    id: string,
    transformOptions: { ssr?: boolean | undefined } | undefined,
): { code: string; map: null } | undefined => {
    if (!shouldTransformForRefresh(id, transformOptions)) {
        return;
    }

    if (!code.includes(REFRESH_REG) && !code.includes(REFRESH_SIG)) {
        return;
    }

    const header = `
import { createModuleRegistration as __createModuleRegistration__ } from "${REFRESH_RUNTIME_SPECIFIER}";
const { ${REFRESH_REG}, ${REFRESH_SIG} } = __createModuleRegistration__(${JSON.stringify(id)});
`;

    return { code: header + code, map: null };
};

function gtkxSwcRefresh(): Plugin {
    return {
        name: "gtkx:swc-refresh",
        enforce: "pre",
        apply: "serve",

        async transform(code, id, transformOptions) {
            if (!shouldTransformForRefresh(id, transformOptions)) {
                return;
            }

            const result = await transform(code, buildSwcOptions(id));

            return buildRefreshResult(result);
        },
    };
}

function gtkxRefreshRuntime(): Plugin {
    return {
        name: "gtkx:refresh-runtime",
        enforce: "post",
        apply: "serve",

        resolveId(id) {
            if (id !== REFRESH_RUNTIME_SPECIFIER) {
                return;
            }

            return fileURLToPath(import.meta.resolve(REFRESH_RUNTIME_SPECIFIER));
        },

        transform(code, id, transformOptions) {
            return injectRefreshRegistration(code, id, transformOptions);
        },
    };
}

const gtkxFastRefresh = (): Plugin[] => [gtkxSwcRefresh(), gtkxRefreshRuntime()];

export { gtkxFastRefresh };
