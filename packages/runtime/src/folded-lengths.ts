import type { Descriptor } from "@gtkx/native";

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

    const existing = sources.get(index);

    if (existing === undefined) {
        sources.set(index, [source]);

        return;
    }

    existing.push(source);
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

const foldedLengthSources = (spec: FoldedLengthSpec): LengthSources => {
    const sources: LengthSources = new Map();
    const returnLengthIndex = effectiveArgIndex(sizedArrayLengthIndex(spec.returnDescriptor), spec.userDataIndex);
    addLengthSource(sources, returnLengthIndex, { kind: "return" });
    addOutArgLengthSources(sources, spec);

    return sources;
};

export { foldedLengthSources, type LengthSource, type LengthSources };
