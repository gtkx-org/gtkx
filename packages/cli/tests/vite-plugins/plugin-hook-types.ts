export type ResolveIdHook = (
    this: {
        resolve: (
            source: string,
            importer?: string,
            opts?: unknown,
        ) => Promise<{ id: string; external?: boolean } | null>;
    },
    source: string,
    importer?: string,
    options?: unknown,
) => string | undefined | null | Promise<string | undefined | null>;

export type LoadHook = (id: string) => string | undefined | null;

export type BuildEndHook = (this: {
    emitFile: (asset: { type: "asset"; fileName: string; source: Buffer }) => string;
}) => void;
