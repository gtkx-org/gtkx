import { copy, type Descriptor } from "@gtkx/native";
import type { CallbackDescriptor, RefDescriptor } from "./descriptors.js";
import { fromNative, toNative } from "./native-value.js";
import { getHandle } from "./registry.js";
import { splitTupleResult } from "./tuple.js";
import { copyValue } from "./value.js";
import { popSeedFrame, pushSeedFrame, type RefSeeds } from "./vfunc-seeds.js";

type Callback = (...args: unknown[]) => unknown;
type CallbackReceiver = "this" | "emitter" | "none";
type OutParam = { value: unknown; descriptor: Descriptor; argIndex: number };
type LengthLink = { target: OutParam; sourceIndex: number };
type OutParamGroups = { lengthLinks: LengthLink[]; valueParams: OutParam[] };

type CallbackSpec = {
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    userDataIndex?: number;
};

type CallbackPlan = {
    fn: Callback;
    effectiveTypes: Descriptor[];
    returnDescriptor: Descriptor;
    start: number;
    receiver: CallbackReceiver;
    hasOutParams: boolean;
    hasRefOutParams: boolean;
};

const fillCallerAllocatedBuffer = (descriptor: Descriptor, target: object, source: object): void => {
    if (descriptor.kind === "boxed" && descriptor.typeName === "GValue") {
        copyValue(getHandle(target), getHandle(source));

        return;
    }

    if ((descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.size !== undefined) {
        copy(getHandle(target), getHandle(source), descriptor.size);

        return;
    }

    throw new Error(`Cannot write caller-allocated ${descriptor.kind} out-parameter: no known byte size`);
};

const isCallerAllocatedOut = (descriptor: Descriptor): boolean =>
    (descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.isCallerAllocated === true;

const collectRefArg = (
    descriptor: RefDescriptor,
    wrappedValue: unknown,
    inputs: unknown[],
    out: { params: OutParam[]; argIndex: number },
): void => {
    if (descriptor.inout === true) {
        inputs.push((wrappedValue as { value: unknown }).value);
    }

    out.params.push({ value: wrappedValue, descriptor, argIndex: out.argIndex });
};

const collectCallbackArg = (
    descriptor: Descriptor | undefined,
    wrappedValue: unknown,
    inputs: unknown[],
    out: { params: OutParam[]; argIndex: number },
): void => {
    if (descriptor?.kind === "ref") {
        collectRefArg(descriptor, wrappedValue, inputs, out);

        return;
    }

    inputs.push(wrappedValue);

    if (descriptor !== undefined && isCallerAllocatedOut(descriptor)) {
        out.params.push({ value: wrappedValue, descriptor, argIndex: out.argIndex });
    }
};

const partitionCallbackArgs = (
    effectiveTypes: Descriptor[],
    wrapped: unknown[],
    start: number,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const params: OutParam[] = [];
    const collected = { params, argIndex: start };

    for (let i = start; i < effectiveTypes.length; i++) {
        collected.argIndex = i;
        collectCallbackArg(effectiveTypes[i], wrapped[i], inputs, collected);
    }

    return { inputs, outParams: params };
};

const hasOutParamArg = (descriptor: Descriptor | undefined): boolean =>
    descriptor !== undefined && (descriptor.kind === "ref" || isCallerAllocatedOut(descriptor));

const hasRefOutParamArg = (descriptor: Descriptor | undefined): boolean =>
    descriptor?.kind === "ref" && descriptor.inout !== true;

const haveOutParamArgs = (effectiveTypes: Descriptor[], start: number): boolean =>
    effectiveTypes.slice(start).some((descriptor) => hasOutParamArg(descriptor));

const haveRefOutParamArgs = (effectiveTypes: Descriptor[], start: number): boolean =>
    effectiveTypes.slice(start).some((descriptor) => hasRefOutParamArg(descriptor));

const sizeParamIndexFor = (descriptor: Descriptor): number | undefined => {
    if (descriptor.kind !== "ref") {
        return undefined;
    }

    const { innerDescriptor } = descriptor;

    return innerDescriptor.kind === "array" ? innerDescriptor.sizeParamIndex : undefined;
};

const lengthOutParamIndices = (outParams: OutParam[]): Map<number, number> => {
    const indices: Map<number, number> = new Map();

    for (const outParam of outParams) {
        const sizeParamIndex = sizeParamIndexFor(outParam.descriptor);

        if (sizeParamIndex !== undefined) {
            indices.set(sizeParamIndex, outParam.argIndex);
        }
    }

    return indices;
};

const writeOutParams = (outParams: OutParam[], outValues: unknown[]): Map<number, unknown> => {
    const written: Map<number, unknown> = new Map();

    for (const [position, outParam] of outParams.entries()) {
        const outValue = outValues[position];
        const { descriptor } = outParam;
        written.set(outParam.argIndex, outValue);

        if (descriptor.kind === "ref") {
            (outParam.value as { value: unknown }).value = toNative(descriptor.innerDescriptor, outValue);
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(descriptor, outParam.value, outValue);
        }
    }

    return written;
};

const groupOutParams = (outParams: OutParam[]): OutParamGroups => {
    const lengths = lengthOutParamIndices(outParams);
    const groups: OutParamGroups = { lengthLinks: [], valueParams: [] };

    for (const outParam of outParams) {
        const sourceIndex = lengths.get(outParam.argIndex);

        if (sourceIndex === undefined) {
            groups.valueParams.push(outParam);
        } else {
            groups.lengthLinks.push({ target: outParam, sourceIndex });
        }
    }

    return groups;
};

const getFoldedLength = (source: unknown): number => {
    const length = (source as { length?: unknown } | null | undefined)?.length;

    return typeof length === "number" ? length : 0;
};

const writeFoldedLengths = (lengthLinks: LengthLink[], written: Map<number, unknown>): void => {
    for (const link of lengthLinks) {
        (link.target.value as { value: unknown }).value = getFoldedLength(written.get(link.sourceIndex));
    }
};

const collectRefSeeds = (outParams: OutParam[]): RefSeeds => {
    const seeds: RefSeeds = new Map();

    for (const outParam of outParams) {
        const seed = (outParam.value as { value?: unknown } | null)?.value;

        if (seed != null && hasRefOutParamArg(outParam.descriptor)) {
            seeds.set(outParam.argIndex, seed);
        }
    }

    return seeds;
};

const applyCallback = (plan: CallbackPlan, thisArg: unknown, inputs: unknown[], outParams: OutParam[]): unknown => {
    if (!plan.hasRefOutParams) {
        return plan.fn.apply(thisArg, inputs);
    }

    pushSeedFrame({ argDescriptors: plan.effectiveTypes, instance: thisArg, seeds: collectRefSeeds(outParams) });

    try {
        return plan.fn.apply(thisArg, inputs);
    } finally {
        popSeedFrame();
    }
};

const getThisArg = (receiver: CallbackReceiver, wrapped: unknown[]): unknown =>
    receiver === "this" ? (wrapped[0] ?? null) : null;

const wrapCallbackArgs = (effectiveTypes: Descriptor[], rawArgs: unknown[]): void => {
    let index = 0;

    for (const descriptor of effectiveTypes) {
        rawArgs[index] = fromNative(descriptor, rawArgs[index]);
        index += 1;
    }
};

const trimCallbackInputs = (plan: CallbackPlan, wrapped: unknown[]): unknown[] => {
    const count = plan.effectiveTypes.length;

    if (wrapped.length > count) {
        wrapped.length = count;
    }

    for (let index = 0; index < plan.start; index++) {
        wrapped.shift();
    }

    return wrapped;
};

const runCallback = (plan: CallbackPlan, rawArgs: unknown[]): unknown => {
    const { effectiveTypes, returnDescriptor } = plan;
    wrapCallbackArgs(effectiveTypes, rawArgs);
    const thisArg = getThisArg(plan.receiver, rawArgs);

    if (!plan.hasOutParams) {
        return toNative(returnDescriptor, plan.fn.apply(thisArg, trimCallbackInputs(plan, rawArgs)));
    }

    const { inputs, outParams } = partitionCallbackArgs(effectiveTypes, rawArgs, plan.start);
    const result = applyCallback(plan, thisArg, inputs, outParams);

    if (outParams.length === 0) {
        return toNative(returnDescriptor, result);
    }

    const { lengthLinks, valueParams } = groupOutParams(outParams);
    const { primary, outValues } = splitTupleResult(result, returnDescriptor.kind !== "void", valueParams.length);
    writeFoldedLengths(lengthLinks, writeOutParams(valueParams, outValues));

    return toNative(returnDescriptor, primary);
};

const getEffectiveTypes = (spec: CallbackSpec): Descriptor[] => {
    const { userDataIndex } = spec;

    if (userDataIndex === undefined) {
        return spec.argDescriptors;
    }

    return spec.argDescriptors.filter((_, i) => i !== userDataIndex);
};

const wrapCallbackValue = (spec: CallbackDescriptor, callback: unknown): unknown =>
    callback == null ? callback : wrapCallback(callback as Callback, spec, "none");

function wrapCallback(fn: Callback, spec: CallbackSpec, receiver: CallbackReceiver): Callback {
    const effectiveTypes = getEffectiveTypes(spec);
    const start = receiver === "none" ? 0 : 1;

    const plan: CallbackPlan = {
        fn,
        effectiveTypes,
        returnDescriptor: spec.returnDescriptor,
        start,
        receiver,
        hasOutParams: haveOutParamArgs(effectiveTypes, start),
        hasRefOutParams: haveRefOutParamArgs(effectiveTypes, start),
    };

    return (...rawArgs: unknown[]): unknown => runCallback(plan, rawArgs);
}

export { isCallerAllocatedOut, wrapCallbackValue, wrapCallback };
