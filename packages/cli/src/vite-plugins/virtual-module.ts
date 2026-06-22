export type VirtualResolveContext = {
    resolve: (
        source: string,
        importer?: string,
        options?: { skipSelf?: boolean } & Record<string, unknown>,
    ) => Promise<{ id: string; external?: boolean | "absolute" | "relative" } | null>;
};

export type VirtualNamespace = {
    isVirtual: (id: string) => boolean;
    toVirtualId: (realId: string) => string;
    fromVirtualId: (id: string) => string;
};

export const createVirtualNamespace = (prefix: string): VirtualNamespace => ({
    isVirtual: (id) => id.startsWith(prefix),
    toVirtualId: (realId) => prefix + realId,
    fromVirtualId: (id) => id.slice(prefix.length),
});

export const resolveToVirtual = async (
    ctx: VirtualResolveContext,
    request: { source: string; importer: string | undefined; options: Record<string, unknown> | undefined },
    prefix: string,
): Promise<string | undefined> => {
    const resolved = await ctx.resolve(request.source, request.importer, { ...request.options, skipSelf: true });
    if (!resolved || resolved.external) return undefined;
    return prefix + resolved.id;
};
