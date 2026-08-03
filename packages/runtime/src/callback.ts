import { copy, type Descriptor } from "@gtkx/native";
import type { CallbackDescriptor, RefDescriptor } from "./descriptors.js";
import { fromNative, toNative } from "./native-value.js";
import { getHandle } from "./registry.js";
import { splitTupleResult } from "./tuple.js";
import { copyValue } from "./value.js";

type Callback = (...args: unknown[]) => unknown;
type CallbackReceiver = "this" | "emitter" | "none";
type OutParam = { value: unknown; descriptor: Descriptor; argIndex: number };

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

    for (let i = start; i < effectiveTypes.length; i++) {
        collectCallbackArg(effectiveTypes[i], wrapped[i], inputs, { params, argIndex: i });
    }

    return { inputs, outParams: params };
};

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

const writeFoldedLengths = (
    lengthParams: OutParam[],
    lengths: Map<number, number>,
    written: Map<number, unknown>,
): void => {
    for (const outParam of lengthParams) {
        const sourceIndex = lengths.get(outParam.argIndex);
        const source = sourceIndex === undefined ? undefined : written.get(sourceIndex);
        (outParam.value as { value: unknown }).value = Array.isArray(source) ? source.length : 0;
    }
};

const getThisArg = (receiver: CallbackReceiver, wrapped: unknown[]): unknown =>
    receiver === "this" ? (wrapped[0] ?? null) : null;

const runCallback = (plan: CallbackPlan, rawArgs: unknown[]): unknown => {
    const { effectiveTypes, returnDescriptor } = plan;
    const wrapped = effectiveTypes.map((descriptor, i) => fromNative(descriptor, rawArgs[i]));
    const thisArg = getThisArg(plan.receiver, wrapped);
    const { inputs, outParams } = partitionCallbackArgs(effectiveTypes, wrapped, plan.start);
    const result = plan.fn.apply(thisArg, inputs);

    if (outParams.length === 0) {
        return toNative(returnDescriptor, result);
    }

    const lengths = lengthOutParamIndices(outParams);
    const lengthParams = outParams.filter((outParam) => lengths.has(outParam.argIndex));
    const valueParams = outParams.filter((outParam) => !lengths.has(outParam.argIndex));
    const { primary, outValues } = splitTupleResult(result, returnDescriptor.kind !== "void", valueParams.length);
    writeFoldedLengths(lengthParams, lengths, writeOutParams(valueParams, outValues));

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
    const plan: CallbackPlan = {
        fn,
        effectiveTypes: getEffectiveTypes(spec),
        returnDescriptor: spec.returnDescriptor,
        start: receiver === "none" ? 0 : 1,
        receiver,
    };

    return (...rawArgs: unknown[]): unknown => runCallback(plan, rawArgs);
}

export { wrapCallbackValue, wrapCallback };
