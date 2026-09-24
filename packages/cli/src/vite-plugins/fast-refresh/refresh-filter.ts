import { SOURCE_ID_RE, sourceLanguage } from "../../internal/source-imports.js";
import { stripQuery } from "../strip-query.js";

const REFRESH_REG = "$RefreshReg$";
const REFRESH_SIG = "$RefreshSig$";
const REFRESH_RUNTIME_SPECIFIER = "@gtkx/cli/refresh-runtime";
const REFRESH_INCLUDE = SOURCE_ID_RE;
const REFRESH_EXCLUDE = /node_modules|[/\\]dist[/\\]|[/\\]\.gtkx[/\\]/;
const REFRESH_ID_FILTER = { include: REFRESH_INCLUDE, exclude: REFRESH_EXCLUDE };
const REFRESH_RUNTIME_ID_RE = new RegExp(`^${REFRESH_RUNTIME_SPECIFIER}$`);

const refreshSourceLanguage = (
    id: string,
    transformOptions: { ssr?: boolean | undefined } | undefined,
): ReturnType<typeof sourceLanguage> => {
    if (!transformOptions?.ssr) {
        return;
    }

    if (REFRESH_EXCLUDE.test(id)) {
        return;
    }

    return sourceLanguage(stripQuery(id));
};

export {
    REFRESH_ID_FILTER,
    REFRESH_REG,
    REFRESH_RUNTIME_ID_RE,
    REFRESH_RUNTIME_SPECIFIER,
    REFRESH_SIG,
    refreshSourceLanguage,
};
