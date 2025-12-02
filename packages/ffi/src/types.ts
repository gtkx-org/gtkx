type SignalParam = { type: import("@gtkx/native").Type; getCls?: () => { prototype: object } };

/**
 * Signal parameter metadata for type-safe signal connections.
 * Used by generated connect methods to wrap signal handler arguments.
 * @internal
 */
export type SignalMeta = Record<string, { params: SignalParam[]; returnType?: import("@gtkx/native").Type }>;
