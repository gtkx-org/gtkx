import { copy, type Descriptor } from "@gtkx/native";
import { isCallerAllocatedDescriptor, isRefDescriptor } from "./arg.js";
import { valueCopyInto } from "./gvalue.js";
import { fromNativeValue, toNativeValue } from "./native-value.js";
import { getHandle } from "./registry.js";
import { splitTupleResult } from "./tuple.js";

const fillCallerAllocatedBuffer = (descriptor: Descriptor, target: object, source: object): void => {
    if (descriptor.kind === "boxed" && descriptor.typeName === "GValue") {
        valueCopyInto(getHandle(target), getHandle(source));
        return;
    }
    if ((descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.size !== undefined) {
        copy(getHandle(target), getHandle(source), descriptor.size);
        return;
    }
    throw new Error(`Cannot write caller-allocated ${descriptor.kind} out-parameter: no known byte size`);
};

type CallbackReceiver = "this" | "emitter" | "none";

type Callback = (...args: unknown[]) => unknown;

export type UserCallback = (...args: never[]) => unknown;

type CallbackSpec = {
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    userDataIndex?: number;
};

type OutParam = { value: unknown; descriptor: Descriptor };

const partitionCallbackArgs = (
    effectiveTypes: Descriptor[],
    wrapped: unknown[],
    start: number,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const outParams: OutParam[] = [];
    for (let i = start; i < effectiveTypes.length; i++) {
        const descriptor = effectiveTypes[i];
        if (descriptor !== undefined && isRefDescriptor(descriptor)) {
            if (descriptor.inout === true) inputs.push((wrapped[i] as { value: unknown }).value);
            outParams.push({ value: wrapped[i], descriptor });
        } else if (descriptor !== undefined && isCallerAllocatedDescriptor(descriptor)) {
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
        if (isRefDescriptor(outParam.descriptor)) {
            (outParam.value as { value: unknown }).value = outValue;
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(outParam.descriptor, outParam.value as object, outValue as object);
        }
    });
};

export function wrapCallback(fn: UserCallback, spec: CallbackSpec, receiver: CallbackReceiver): Callback {
    const { returnDescriptor, userDataIndex } = spec;
    const effectiveTypes =
        userDataIndex === undefined ? spec.argDescriptors : spec.argDescriptors.filter((_, i) => i !== userDataIndex);
    const start = receiver === "none" ? 0 : 1;
    return (...rawArgs: unknown[]): unknown => {
        const wrapped = effectiveTypes.map((descriptor, i) => fromNativeValue(descriptor, rawArgs[i]));
        const thisArg = receiver === "this" ? (wrapped[0] ?? null) : null;
        const { inputs, outParams } = partitionCallbackArgs(effectiveTypes, wrapped, start);
        const result = (fn as (this: unknown, ...args: unknown[]) => unknown).apply(thisArg, inputs);
        if (outParams.length === 0) {
            return toNativeValue(returnDescriptor, result);
        }
        const { primary, outValues } = splitTupleResult(result, returnDescriptor.kind !== "void", outParams.length);
        writeOutParams(outParams, outValues);
        return toNativeValue(returnDescriptor, primary);
    };
}
