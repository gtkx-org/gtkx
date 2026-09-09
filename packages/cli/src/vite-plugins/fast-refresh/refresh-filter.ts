const REFRESH_REG = "$RefreshReg$";
const REFRESH_SIG = "$RefreshSig$";
const REFRESH_RUNTIME_SPECIFIER = "@gtkx/cli/refresh-runtime";
const REFRESH_INCLUDE = /\.[tj]sx?$/;
const REFRESH_EXCLUDE = /node_modules|[/\\]dist[/\\]|[/\\]\.gtkx[/\\]/;
const REFRESH_ID_FILTER = { include: REFRESH_INCLUDE, exclude: REFRESH_EXCLUDE };
const REFRESH_RUNTIME_ID_RE = new RegExp(`^${REFRESH_RUNTIME_SPECIFIER}$`);

const shouldTransformForRefresh = (
    id: string,
    transformOptions: { ssr?: boolean | undefined } | undefined,
): boolean => {
    if (!transformOptions?.ssr) {
        return false;
    }

    if (!REFRESH_INCLUDE.test(id)) {
        return false;
    }

    if (REFRESH_EXCLUDE.test(id)) {
        return false;
    }

    return true;
};

export {
    REFRESH_ID_FILTER,
    REFRESH_REG,
    REFRESH_RUNTIME_ID_RE,
    REFRESH_RUNTIME_SPECIFIER,
    REFRESH_SIG,
    shouldTransformForRefresh,
};
