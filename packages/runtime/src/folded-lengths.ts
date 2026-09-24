import type { Descriptor } from "./descriptor-types.js";

type LengthSource = { kind: "return" } | { kind: "outArg"; argIndex: number };
type LengthSources = Map<number, LengthSource[]>;

type FoldedLengthSpec = {
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    userDataIndex?: number | undefined;
};

const sizedArrayLengthIndex = (descriptor: Descriptor): number | undefined =>
    descriptor.kind === "array" && descriptor.arrayKind === "sized" ? descriptor.sizeParamIndex : undefined;

const outArgLengthIndex = (descriptor: Descriptor | undefined): number | undefined =>
    descriptor?.kind === "ref" ? sizedArrayLengthIndex(descriptor.innerDescriptor) : undefined;

const inputArgLengthIndex = (descriptor: Descriptor | undefined): number | undefined => {
    if (descriptor === undefined) {
        return undefined;
    }

    if (descriptor.kind === "ref") {
        return descriptor.inout === true ? sizedArrayLengthIndex(descriptor.innerDescriptor) : undefined;
    }

    return sizedArrayLengthIndex(descriptor);
};

const effectiveArgIndex = (argIndex: number | undefined, userDataIndex: number | undefined): number | undefined => {
    if (argIndex === undefined || userDataIndex === undefined || argIndex < userDataIndex) {
        return argIndex;
    }

    return argIndex === userDataIndex ? undefined : argIndex - 1;
};

const addLengthSource = (sources: LengthSources, index: number | undefined, source: LengthSource): void => {
    if (index === undefined) {
        return;
    }

    sources.getOrInsertComputed(index, () => []).push(source);
};

const addOutArgLengthSources = (sources: LengthSources, spec: FoldedLengthSpec): void => {
    const { userDataIndex } = spec;

    for (const [declaredIndex, descriptor] of spec.argDescriptors.entries()) {
        const argIndex = effectiveArgIndex(declaredIndex, userDataIndex);

        if (argIndex !== undefined) {
            const lengthIndex = effectiveArgIndex(outArgLengthIndex(descriptor), userDataIndex);
            addLengthSource(sources, lengthIndex, { kind: "outArg", argIndex });
        }
    }
};

const foldedLengthArgIndices = (spec: FoldedLengthSpec): ReadonlySet<number> => {
    const indices: Set<number> = new Set();

    const add = (declaredIndex: number | undefined): void => {
        const argIndex = effectiveArgIndex(declaredIndex, spec.userDataIndex);

        if (argIndex !== undefined) {
            indices.add(argIndex);
        }
    };

    add(sizedArrayLengthIndex(spec.returnDescriptor));

    for (const descriptor of spec.argDescriptors) {
        add(sizedArrayLengthIndex(descriptor));
        add(outArgLengthIndex(descriptor));
    }

    return indices;
};

const foldedInputLengthSources = (spec: FoldedLengthSpec): ReadonlyMap<number, number> => {
    const sources: Map<number, number> = new Map();

    for (const [declaredIndex, descriptor] of spec.argDescriptors.entries()) {
        const lengthIndex = effectiveArgIndex(inputArgLengthIndex(descriptor), spec.userDataIndex);
        const sourceIndex = effectiveArgIndex(declaredIndex, spec.userDataIndex);

        if (lengthIndex !== undefined && sourceIndex !== undefined) {
            sources.set(lengthIndex, sourceIndex);
        }
    }

    return sources;
};

const foldedValueLength = (value: unknown): number => {
    const length = (value as { length?: unknown } | null | undefined)?.length;

    return typeof length === "number" ? length : 0;
};

const foldedLengthSources = (spec: FoldedLengthSpec): LengthSources => {
    const sources: LengthSources = new Map();
    const returnLengthIndex = effectiveArgIndex(sizedArrayLengthIndex(spec.returnDescriptor), spec.userDataIndex);
    addLengthSource(sources, returnLengthIndex, { kind: "return" });
    addOutArgLengthSources(sources, spec);

    return sources;
};

export {
    foldedInputLengthSources,
    foldedLengthArgIndices,
    foldedLengthSources,
    foldedValueLength,
    type LengthSource,
    type LengthSources,
};
