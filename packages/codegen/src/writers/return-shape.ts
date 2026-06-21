/**
 * Inputs to {@link foldOutParamShape}.
 */
export type OutParamShape = {
    primary: string | undefined;
    outTypes: string[];
    hasPrimary: boolean;
};

/**
 * Folds a primary return value and one or more out/inout parameter types into a
 * tuple-shaped TypeScript return type.
 *
 * This covers only the case where at least one out parameter is present:
 *
 * - with a primary value, emits `[primary, ...outTypes]`;
 * - with a single out parameter and no primary, emits that out type alone;
 * - otherwise emits a tuple of all out types.
 *
 * Callers handle the no-out-parameter case themselves, since the FFI and React
 * surfaces differ there (the React surface appends ` | undefined`).
 *
 * @param shape - The primary return source, the out-parameter type sources, and
 *   whether a primary value is present.
 * @returns The folded TypeScript return-type source.
 */
export const foldOutParamShape = (shape: OutParamShape): string => {
    const { primary, outTypes, hasPrimary } = shape;
    if (hasPrimary && primary !== undefined) return `[${primary}, ${outTypes.join(", ")}]`;
    const [single, ...rest] = outTypes;
    if (rest.length === 0 && single !== undefined) return single;
    return `[${outTypes.join(", ")}]`;
};
