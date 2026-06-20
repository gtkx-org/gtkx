export const REFRESH_REG = "$RefreshReg$";

export const REFRESH_SIG = "$RefreshSig$";

export const REFRESH_RUNTIME_SPECIFIER = "@gtkx/cli/refresh-runtime";

export type RefreshFilterOptions = {
    include?: RegExp;
    exclude?: RegExp;
};

const defaultInclude = /\.[tj]sx?$/;
const defaultExclude = /node_modules|[/\\]dist[/\\]|[/\\]\.gtkx[/\\]/;

type ResolvedRefreshFilter = {
    include: RegExp;
    exclude: RegExp;
};

const resolveRefreshFilter = (options: RefreshFilterOptions): ResolvedRefreshFilter => ({
    include: options.include ?? defaultInclude,
    exclude: options.exclude ?? defaultExclude,
});

const shouldTransformForRefresh = (
    id: string,
    transformOptions: { ssr?: boolean | undefined } | undefined,
    filter: ResolvedRefreshFilter,
): boolean => {
    if (!transformOptions?.ssr) return false;
    if (!filter.include.test(id)) return false;
    if (filter.exclude.test(id)) return false;
    return true;
};

export type RefreshGate = (id: string, transformOptions: { ssr?: boolean | undefined } | undefined) => boolean;

export const createRefreshGate = (options: RefreshFilterOptions): RefreshGate => {
    const filter = resolveRefreshFilter(options);
    return (id, transformOptions) => shouldTransformForRefresh(id, transformOptions, filter);
};
