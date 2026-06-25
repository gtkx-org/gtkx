export type OutParamShape = {
    primary: string | undefined;
    outTypes: string[];
    hasPrimary: boolean;
};

export const foldOutParamShape = (shape: OutParamShape): string => {
    const { primary, outTypes, hasPrimary } = shape;
    if (hasPrimary && primary !== undefined) return `[${primary}, ${outTypes.join(", ")}]`;
    const [single, ...rest] = outTypes;
    if (rest.length === 0 && single !== undefined) return single;
    return `[${outTypes.join(", ")}]`;
};
