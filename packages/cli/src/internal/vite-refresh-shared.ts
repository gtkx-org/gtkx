/**
 * Shared options accepted by the SSR refresh-related Vite plugins.
 */
export type RefreshFilterOptions = {
    /** File pattern to include — defaults to JS/TS source files. */
    include?: RegExp;
    /** File pattern to exclude — defaults to `node_modules`, built `dist` output, and the generated `.gtkx` store. */
    exclude?: RegExp;
};

const defaultInclude = /\.[tj]sx?$/;
const defaultExclude = /node_modules|[/\\]dist[/\\]|[/\\]\.gtkx[/\\]/;

export type ResolvedRefreshFilter = {
    include: RegExp;
    exclude: RegExp;
};

/**
 * Resolves include/exclude patterns from user options, falling back to defaults.
 */
export function resolveRefreshFilter(options: RefreshFilterOptions): ResolvedRefreshFilter {
    return {
        include: options.include ?? defaultInclude,
        exclude: options.exclude ?? defaultExclude,
    };
}

/**
 * Returns true when the given module ID should be transformed by an SSR refresh plugin.
 * Skips non-SSR transforms, files that do not match `include`, and files that match `exclude`.
 */
export function shouldTransformForRefresh(
    id: string,
    transformOptions: { ssr?: boolean } | undefined,
    filter: ResolvedRefreshFilter,
): boolean {
    if (!transformOptions?.ssr) return false;
    if (!filter.include.test(id)) return false;
    if (filter.exclude.test(id)) return false;
    return true;
}
