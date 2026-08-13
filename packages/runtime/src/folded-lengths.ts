import type { Descriptor } from "@gtkx/native";

type LengthSource = { kind: "return" } | { kind: "outArg"; argIndex: number };
type LengthSources = Map<number, LengthSource[]>;

const sizedArrayLengthIndex = (descriptor: Descriptor): number | undefined =>
    descriptor.kind === "array" && descriptor.arrayKind === "sized" ? descriptor.sizeParamIndex : undefined;

const outArgLengthIndex = (descriptor: Descriptor | undefined): number | undefined =>
    descriptor?.kind === "ref" ? sizedArrayLengthIndex(descriptor.innerDescriptor) : undefined;

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

const foldedLengthSources = (argDescriptors: Descriptor[], returnDescriptor: Descriptor): LengthSources => {
    const sources: LengthSources = new Map();
    addLengthSource(sources, sizedArrayLengthIndex(returnDescriptor), { kind: "return" });

    for (const [argIndex, descriptor] of argDescriptors.entries()) {
        addLengthSource(sources, outArgLengthIndex(descriptor), { kind: "outArg", argIndex });
    }

    return sources;
};

export { foldedLengthSources, type LengthSource, type LengthSources };
