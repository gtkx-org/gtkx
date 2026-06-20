/**
 * Global the SWC transform emits a registration function into and the header
 * plugin destructures back out, completing the transform→header handshake.
 */
export const REFRESH_REG = "$RefreshReg$";

/**
 * Global the SWC transform emits a signature function into and the header
 * plugin destructures back out, completing the transform→header handshake.
 */
export const REFRESH_SIG = "$RefreshSig$";

/**
 * Module specifier the header plugin resolves and imports the in-process
 * registration runtime from. Published as the `@gtkx/cli/refresh-runtime`
 * export condition so the dev server can hand the app the runtime by name.
 */
export const REFRESH_RUNTIME_SPECIFIER = "@gtkx/cli/refresh-runtime";

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
    transformOptions: { ssr?: boolean } | undefined,
    filter: ResolvedRefreshFilter,
): boolean => {
    if (!transformOptions?.ssr) return false;
    if (!filter.include.test(id)) return false;
    if (filter.exclude.test(id)) return false;
    return true;
};

/**
 * Predicate a refresh plugin gates each transform on: true when the module id
 * is an SSR source file that passes the resolved include/exclude filter.
 */
export type RefreshGate = (id: string, transformOptions: { ssr?: boolean } | undefined) => boolean;

/**
 * Resolves the include/exclude filter once and returns the per-transform
 * {@link RefreshGate} predicate closing over it, so each refresh plugin opens
 * its transform hook with one guard call instead of re-spelling resolve+test.
 *
 * @param options - Include/exclude overrides; defaults cover JS/TS sources
 *   while skipping `node_modules`, built `dist` output, and the generated
 *   `.gtkx` store.
 * @returns The gate predicate for the resolved filter.
 */
export const createRefreshGate = (options: RefreshFilterOptions): RefreshGate => {
    const filter = resolveRefreshFilter(options);
    return (id, transformOptions) => shouldTransformForRefresh(id, transformOptions, filter);
};
