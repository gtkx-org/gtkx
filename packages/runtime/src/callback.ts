import { copy, type Descriptor } from "@gtkx/native";
import type { CallbackDescriptor, RefDescriptor } from "./descriptors.js";
import { fromNative, toNative } from "./native-value.js";
import { getHandle } from "./registry.js";
import { splitTupleResult } from "./tuple.js";
import { copyValue } from "./value.js";

type Callback = (...args: unknown[]) => unknown;
type CallbackReceiver = "this" | "emitter" | "none";
type OutParam = { value: unknown; descriptor: Descriptor };

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
    (descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.callerAllocated === true;

const collectRefArg = (
    descriptor: RefDescriptor,
    wrappedValue: unknown,
    inputs: unknown[],
    outParams: OutParam[],
): void => {
    if (descriptor.inout === true) {
        inputs.push((wrappedValue as { value: unknown }).value);
    }

    outParams.push({ value: wrappedValue, descriptor });
};

const collectCallbackArg = (
    descriptor: Descriptor | undefined,
    wrappedValue: unknown,
    inputs: unknown[],
    outParams: OutParam[],
): void => {
    if (descriptor?.kind === "ref") {
        collectRefArg(descriptor, wrappedValue, inputs, outParams);

        return;
    }

    inputs.push(wrappedValue);

    if (descriptor !== undefined && isCallerAllocatedOut(descriptor)) {
        outParams.push({ value: wrappedValue, descriptor });
    }
};

const partitionCallbackArgs = (
    effectiveTypes: Descriptor[],
    wrapped: unknown[],
    start: number,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const outParams: OutParam[] = [];

    for (let i = start; i < effectiveTypes.length; i++) {
        collectCallbackArg(effectiveTypes[i], wrapped[i], inputs, outParams);
    }

    return { inputs, outParams };
};

const writeOutParams = (outParams: OutParam[], outValues: unknown[]): void => {
    for (const [position, outParam] of outParams.entries()) {
        const outValue = outValues[position];

        if (outParam.descriptor.kind === "ref") {
            (outParam.value as { value: unknown }).value = outValue;
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(outParam.descriptor, outParam.value, outValue);
        }
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

    const { primary, outValues } = splitTupleResult(result, returnDescriptor.kind !== "void", outParams.length);
    writeOutParams(outParams, outValues);

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
