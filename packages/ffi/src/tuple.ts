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
        if (Array.isArray(result)) {
            return { primary: result[0], outValues: result.slice(1) };
        }
        return { primary: result, outValues: [] };
    }
    if (outCount === 1) {
        return { primary: undefined, outValues: [result] };
    }
    return { primary: undefined, outValues: Array.isArray(result) ? result : [] };
};
