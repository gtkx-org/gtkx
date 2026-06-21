/**
 * Composable primitives for the NUL-prefixed virtual-module convention shared
 * by the GTKX asset Vite plugins.
 *
 * Each plugin owns a distinct virtual namespace whose real ids are wrapped
 * behind a `\0`-prefixed marker so Rollup leaves them untouched. This module
 * factors the two pieces every plugin duplicates: the prefix round-trip
 * (wrap a resolved id, test it, unwrap it) via {@link createVirtualNamespace},
 * and the `skipSelf` resolve plus external-guard via {@link resolveToVirtual}.
 *
 * The `load` bodies are intentionally not shared — each plugin renders an
 * entirely different module from its unwrapped id.
 */

/**
 * The minimal Rollup plugin-context surface {@link resolveToVirtual} needs: a
 * `resolve` that maps an import specifier to its resolved id or `null`.
 */
export type VirtualResolveContext = {
    resolve: (
        source: string,
        importer?: string,
        options?: { skipSelf?: boolean } & Record<string, unknown>,
    ) => Promise<{ id: string; external?: boolean | "absolute" | "relative" } | null>;
};

/**
 * The prefix round-trip helpers for one virtual namespace, all keyed on the
 * namespace's `\0`-prefixed marker.
 */
export type VirtualNamespace = {
    /** Whether `id` belongs to this namespace. */
    isVirtual: (id: string) => boolean;
    /** Wraps a resolved real id as a virtual id in this namespace. */
    toVirtualId: (realId: string) => string;
    /** Strips the namespace prefix, recovering the real id from a virtual id. */
    fromVirtualId: (id: string) => string;
};

/**
 * Creates the prefix round-trip helpers for one NUL-prefixed virtual namespace.
 *
 * @param prefix - The `\0`-prefixed marker identifying the namespace.
 * @returns The {@link VirtualNamespace} bound to `prefix`.
 */
export const createVirtualNamespace = (prefix: string): VirtualNamespace => ({
    isVirtual: (id) => id.startsWith(prefix),
    toVirtualId: (realId) => prefix + realId,
    fromVirtualId: (id) => id.slice(prefix.length),
});

/**
 * Resolves an import specifier and wraps it as a virtual id, owning the
 * `skipSelf` resolve and the external/unresolved guard the asset plugins share.
 *
 * @param ctx - The plugin context exposing `resolve`.
 * @param request - The `resolveId` hook arguments: the specifier, the importer,
 *   and the options forwarded to `resolve`.
 * @param prefix - The `\0`-prefixed marker to wrap the resolved id with.
 * @returns The virtual id, or `undefined` when the specifier is unresolved or
 *   external.
 */
export const resolveToVirtual = async (
    ctx: VirtualResolveContext,
    request: { source: string; importer: string | undefined; options: Record<string, unknown> | undefined },
    prefix: string,
): Promise<string | undefined> => {
    const resolved = await ctx.resolve(request.source, request.importer, { ...request.options, skipSelf: true });
    if (!resolved || resolved.external) return undefined;
    return prefix + resolved.id;
};
