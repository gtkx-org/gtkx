const REFRESH_REG = "$RefreshReg$";
const REFRESH_SIG = "$RefreshSig$";
const REFRESH_RUNTIME_SPECIFIER = "@gtkx/cli/refresh-runtime";
const REFRESH_INCLUDE = /\.[tj]sx?$/;
const REFRESH_EXCLUDE = /node_modules|[/\\]dist[/\\]|[/\\]\.gtkx[/\\]/;

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

export { REFRESH_REG, REFRESH_SIG, REFRESH_RUNTIME_SPECIFIER, shouldTransformForRefresh };
