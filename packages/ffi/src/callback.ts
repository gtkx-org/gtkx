import { copy, type Descriptor } from "@gtkx/native";
import type { CallbackDescriptor } from "./descriptors.js";
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

const partitionCallbackArgs = (
    effectiveTypes: Descriptor[],
    wrapped: unknown[],
    start: number,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const outParams: OutParam[] = [];
    for (let i = start; i < effectiveTypes.length; i++) {
        const descriptor = effectiveTypes[i];
        if (descriptor !== undefined && descriptor.kind === "ref") {
            if (descriptor.inout === true) inputs.push((wrapped[i] as { value: unknown }).value);
            outParams.push({ value: wrapped[i], descriptor });
        } else if (
            descriptor !== undefined &&
            (descriptor.kind === "boxed" || descriptor.kind === "struct") &&
            descriptor.callerAllocated === true
        ) {
            inputs.push(wrapped[i]);
            outParams.push({ value: wrapped[i], descriptor });
        } else {
            inputs.push(wrapped[i]);
        }
    }
    return { inputs, outParams };
};

const writeOutParams = (outParams: OutParam[], outValues: unknown[]): void => {
    outParams.forEach((outParam, position) => {
        const outValue = outValues[position];
        if (outParam.descriptor.kind === "ref") {
            (outParam.value as { value: unknown }).value = outValue;
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(outParam.descriptor, outParam.value as object, outValue as object);
        }
    });
};

export const wrapCallbackValue = (spec: CallbackDescriptor, callback: unknown): unknown =>
    callback == null ? callback : wrapCallback(callback as Callback, spec, "none");

export function wrapCallback(fn: Callback, spec: CallbackSpec, receiver: CallbackReceiver): Callback {
    const { returnDescriptor, userDataIndex } = spec;
    const effectiveTypes =
        userDataIndex === undefined ? spec.argDescriptors : spec.argDescriptors.filter((_, i) => i !== userDataIndex);
    const start = receiver === "none" ? 0 : 1;
    return (...rawArgs: unknown[]): unknown => {
        const wrapped = effectiveTypes.map((descriptor, i) => fromNative(descriptor, rawArgs[i]));
        const thisArg = receiver === "this" ? (wrapped[0] ?? null) : null;
        const { inputs, outParams } = partitionCallbackArgs(effectiveTypes, wrapped, start);
        const result = (fn as (this: unknown, ...args: unknown[]) => unknown).apply(thisArg, inputs);
        if (outParams.length === 0) {
            return toNative(returnDescriptor, result);
        }
        const { primary, outValues } = splitTupleResult(result, returnDescriptor.kind !== "void", outParams.length);
        writeOutParams(outParams, outValues);
        return toNative(returnDescriptor, primary);
    };
}
