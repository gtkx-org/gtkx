type VirtualResolveContext = {
    resolve: (
        source: string,
        importer?: string,
        options?: { skipSelf?: boolean } & Record<string, unknown>,
    ) => Promise<{ id: string; external?: boolean | "absolute" | "relative" } | null>;
};

type VirtualResolveRequest = {
    source: string;
    importer: string | undefined;
    options: Record<string, unknown> | undefined;
};

type VirtualNamespace = {
    isVirtual: (id: string) => boolean;
    toVirtualId: (realId: string) => string;
    fromVirtualId: (id: string) => string;
    resolveToVirtual: (ctx: VirtualResolveContext, request: VirtualResolveRequest) => Promise<string | undefined>;
};

const createVirtualNamespace = (prefix: string): VirtualNamespace => {
    const toVirtualId = (realId: string): string => prefix + realId;

    return {
        isVirtual: (id) => id.startsWith(prefix),
        toVirtualId,
        fromVirtualId: (id) => id.slice(prefix.length),
        resolveToVirtual: async (ctx, request) => {
            const resolved = await ctx.resolve(request.source, request.importer, {
                ...request.options,
                skipSelf: true,
            });

            if (!resolved || resolved.external) {
                return;
            }

            return toVirtualId(resolved.id);
        },
    };
};

export { createVirtualNamespace };
