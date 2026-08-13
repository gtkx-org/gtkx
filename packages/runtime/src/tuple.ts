import type { Descriptor } from "@gtkx/native";

type SplitResult = { primary: unknown; outValues: unknown[] };

const hasSurfacedPrimary = (returnDescriptor: Descriptor, isReturnSkipped: boolean | undefined): boolean =>
    returnDescriptor.kind !== "void" && isReturnSkipped !== true;

const packTupleResult = (outs: unknown[], primary: unknown, hasPrimary: boolean): unknown => {
    if (hasPrimary) {
        return outs.length === 0 ? primary : [primary, ...outs];
    }

    if (outs.length === 0) {
        return undefined;
    }

    if (outs.length === 1) {
        return outs[0];
    }

    return outs;
};

const splitPrimaryResult = (result: unknown, outCount: number): SplitResult => {
    if (outCount > 0 && Array.isArray(result)) {
        return { primary: result[0], outValues: result.slice(1) };
    }

    return { primary: result, outValues: [] };
};

const splitOutResult = (result: unknown, outCount: number): SplitResult => {
    if (outCount === 1) {
        return { primary: undefined, outValues: [result] };
    }

    return { primary: undefined, outValues: Array.isArray(result) ? result : [] };
};

const splitTupleResult = (result: unknown, hasPrimary: boolean, outCount: number): SplitResult =>
    hasPrimary ? splitPrimaryResult(result, outCount) : splitOutResult(result, outCount);

export { hasSurfacedPrimary, packTupleResult, splitTupleResult };
