import type { Type, Value } from "@gtkx/native";
import { type ArgCategory, categoryOfType, isOutCellType } from "./arg-category.js";
import { valueCopyInto } from "./gvalue.js";
import { fromNativeValue, toNativeValue } from "./native-value.js";
import { getHandle } from "./registry.js";
import { splitTupleResult } from "./tuple.js";

const copyBoxedFields = (target: object, source: object): void => {
    let proto: object | null = Object.getPrototypeOf(target);
    while (proto !== null && proto !== Object.prototype) {
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
            if (descriptor.get !== undefined && descriptor.set !== undefined) {
                (target as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key];
            }
        }
        proto = Object.getPrototypeOf(proto);
    }
};

const fillCallerAllocatedBuffer = (descriptor: Type, target: object, source: object): void => {
    if (descriptor.type === "boxed" && descriptor.innerType === "GValue") {
        valueCopyInto(getHandle(target), getHandle(source));
        return;
    }
    copyBoxedFields(target, source);
};

type CallbackReceiver = "this" | "emitter" | "none";

type Callback = (...args: Value[]) => Value;

export type UserCallback = (...args: never[]) => unknown;

type CallbackSpec = {
    argTypes: Type[];
    returnType: Type;
    userDataIndex?: number;
};

type OutParam = { value: unknown; descriptor: Type };

const partitionCallbackArgs = (
    effectiveTypes: Type[],
    wrapped: unknown[],
    start: number,
    receiver: CallbackReceiver,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const outParams: OutParam[] = [];
    for (let i = start; i < effectiveTypes.length; i++) {
        const descriptor = effectiveTypes[i];
        const category: ArgCategory = descriptor === undefined ? { kind: "plainInput" } : categoryOfType(descriptor);
        if (descriptor !== undefined && category.kind === "outCell") {
            if (category.inout) inputs.push((wrapped[i] as { value: unknown }).value);
            outParams.push({ value: wrapped[i], descriptor });
        } else if (descriptor !== undefined && category.kind === "callerAllocated" && receiver === "this") {
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
        if (isOutCellType(outParam.descriptor)) {
            (outParam.value as { value: unknown }).value = outValue;
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(outParam.descriptor, outParam.value as object, outValue as object);
        }
    });
};

export function wrapCallback(fn: UserCallback, spec: CallbackSpec, receiver: CallbackReceiver): Callback {
    const { returnType, userDataIndex } = spec;
    const effectiveTypes =
        userDataIndex === undefined ? spec.argTypes : spec.argTypes.filter((_, i) => i !== userDataIndex);
    const start = receiver === "none" ? 0 : 1;
    return (...rawArgs: Value[]): Value => {
        const wrapped = effectiveTypes.map((descriptor, i) => fromNativeValue(descriptor, rawArgs[i]));
        const thisArg = receiver === "this" ? (wrapped[0] ?? null) : null;
        const { inputs, outParams } = partitionCallbackArgs(effectiveTypes, wrapped, start, receiver);
        const result = (fn as (this: unknown, ...args: unknown[]) => unknown).apply(thisArg, inputs);
        if (outParams.length === 0) {
            return toNativeValue(returnType, result);
        }
        const { primary, outValues } = splitTupleResult(result, returnType.type !== "void", outParams.length);
        writeOutParams(outParams, outValues);
        return toNativeValue(returnType, primary);
    };
}
