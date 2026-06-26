/**
 * The multi-out tuple convention shared by the function-call and callback paths.
 *
 * A native call (or a JS callback) can produce a primary return value plus zero
 * or more out/inout values. Both sides encode that set as a single JS value:
 *
 * - with a primary and no outs: the primary alone;
 * - with a primary and one or more outs: `[primary, ...outs]`;
 * - with no primary and a single out: that out alone;
 * - with no primary and multiple outs: `[...outs]`;
 * - with no primary and no outs: `undefined`.
 *
 * {@link packTupleResult} encodes that set for a value flowing JS→native (the
 * function-call read-back), and {@link splitTupleResult} decodes a JS callback's
 * returned value back into its primary and out components.
 */

export const packTupleResult = (outs: unknown[], primary: unknown, hasPrimary: boolean): unknown => {
    if (hasPrimary) {
        return outs.length === 0 ? primary : [primary, ...outs];
    }
    if (outs.length === 0) return undefined;
    if (outs.length === 1) return outs[0];
    return outs;
};

export const splitTupleResult = (
    result: unknown,
    hasPrimary: boolean,
    outCount: number,
): { primary: unknown; outValues: unknown[] } => {
    if (hasPrimary) {
        const tuple = result as unknown[];
        return { primary: tuple[0], outValues: tuple.slice(1) };
    }
    if (outCount === 1) {
        return { primary: undefined, outValues: [result] };
    }
    return { primary: undefined, outValues: result as unknown[] };
};
