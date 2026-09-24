import type { Plugin } from "vite";
import { type Output, type Options as SwcOptions, transform } from "@swc/core";
import { fileURLToPath } from "node:url";
import type { sourceLanguage } from "../../internal/source-imports.js";
import {
    REFRESH_ID_FILTER,
    REFRESH_REG,
    REFRESH_RUNTIME_ID_RE,
    REFRESH_RUNTIME_SPECIFIER,
    REFRESH_SIG,
    refreshSourceLanguage,
} from "./refresh-filter.js";

type SourceLanguage = NonNullable<ReturnType<typeof sourceLanguage>>;
type RefreshLanguage = Exclude<SourceLanguage, "ts">;

const buildTypeStripOptions = (id: string): SwcOptions => ({
    filename: id,
    sourceFileName: id,
    sourceMaps: true,
    jsc: {
        parser: { syntax: "typescript", tsx: false },
        target: "es2022",
    },
});

const buildRefreshOptions = (
    id: string,
    language: RefreshLanguage,
    inputSourceMap?: string,
): SwcOptions => ({
    ...(inputSourceMap !== undefined && { inputSourceMap }),
    filename: id,
    sourceFileName: id,
    sourceMaps: true,
    jsc: {
        parser: language === "tsx"
            ? { syntax: "typescript", tsx: true }
            : { syntax: "ecmascript", jsx: true },
        transform: {
            react: {
                runtime: "automatic",
                development: true,
                refresh: true,
            },
        },
        target: "es2022",
    },
});

const transformForRefresh = async (code: string, id: string, language: SourceLanguage): Promise<Output> => {
    if (language !== "ts") {
        return transform(code, buildRefreshOptions(id, language));
    }

    const stripped = await transform(code, buildTypeStripOptions(id));

    return transform(stripped.code, buildRefreshOptions(id, "jsx", stripped.map));
};

const buildRefreshResult = (result: Output): { code: string; map?: string } =>
    result.map === undefined ? { code: result.code } : { code: result.code, map: result.map };

const injectRefreshRegistration = (
    code: string,
    id: string,
    transformOptions: { ssr?: boolean | undefined } | undefined,
): { code: string; map: null } | undefined => {
    if (refreshSourceLanguage(id, transformOptions) === undefined) {
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

        transform: {
            filter: { id: REFRESH_ID_FILTER },

            async handler(code, id, transformOptions) {
                const language = refreshSourceLanguage(id, transformOptions);

                if (language === undefined) {
                    return;
                }

                const result = await transformForRefresh(code, id, language);

                return buildRefreshResult(result);
            },
        },
    };
}

function gtkxRefreshRuntime(): Plugin {
    return {
        name: "gtkx:refresh-runtime",
        enforce: "post",
        apply: "serve",

        resolveId: {
            filter: { id: REFRESH_RUNTIME_ID_RE },

            handler(id) {
                if (id !== REFRESH_RUNTIME_SPECIFIER) {
                    return;
                }

                return fileURLToPath(import.meta.resolve(REFRESH_RUNTIME_SPECIFIER));
            },
        },

        transform: {
            filter: { id: REFRESH_ID_FILTER, code: { include: [REFRESH_REG, REFRESH_SIG] } },

            handler(code, id, transformOptions) {
                return injectRefreshRegistration(code, id, transformOptions);
            },
        },
    };
}

const gtkxFastRefresh = (): Plugin[] => [gtkxSwcRefresh(), gtkxRefreshRuntime()];

export { gtkxFastRefresh };
