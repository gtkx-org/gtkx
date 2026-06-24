import type { Type, RefType, Value } from "@gtkx/native";
import { type ArgCategory, type ArgDirectionMeta, classifyArgCategory } from "./arg-category.js";
import { valueCopyInto } from "./gvalue.js";
import { getHandle } from "./registry.js";
import { unwrapValue, wrapValue } from "./wrap-value.js";

const isOutCell = (descriptor: Type): descriptor is RefType => descriptor.type === "ref";

const isCallerAllocatedBuffer = (descriptor: Type): boolean =>
    (descriptor.type === "boxed" || descriptor.type === "struct") && descriptor.callerAllocated === true;

const argDirectionMetaOf = (descriptor: Type): ArgDirectionMeta => {
    if (isOutCell(descriptor)) return { direction: descriptor.inout === true ? "inout" : "out", callerAllocated: false };
    if (isCallerAllocatedBuffer(descriptor)) return { direction: "out", callerAllocated: true };
    return { callerAllocated: false };
};

const categoryOf = (descriptor: Type): ArgCategory => classifyArgCategory(argDirectionMetaOf(descriptor));

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

const splitCallbackResult = (
    result: unknown,
    hasPrimary: boolean,
    outCount: number,
): { primary: unknown; outValues: unknown[] } => {
    if (hasPrimary) {
        const tuple = result as unknown[];
        return { primary: tuple[0], outValues: tuple.slice(1) };
    }
    if (outCount === 1) {
        return { primary: undefined, outValues: [result] };
    }
    return { primary: undefined, outValues: result as unknown[] };
};

export type CallbackReceiver = "this" | "skip" | "none";

export type Callback = (...args: Value[]) => Value;

export type UserCallback = (...args: never[]) => unknown;

export type CallbackSpec = {
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
        const category: ArgCategory = descriptor === undefined ? { kind: "plainInput" } : categoryOf(descriptor);
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
        if (isOutCell(outParam.descriptor)) {
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
        const wrapped = effectiveTypes.map((descriptor, i) => wrapValue(descriptor, rawArgs[i]));
        const thisArg = receiver === "this" ? (wrapped[0] ?? null) : null;
        const { inputs, outParams } = partitionCallbackArgs(effectiveTypes, wrapped, start, receiver);
        const result = (fn as (this: unknown, ...args: unknown[]) => unknown).apply(thisArg, inputs);
        if (outParams.length === 0) {
            return unwrapValue(returnType, result);
        }
        const { primary, outValues } = splitCallbackResult(result, returnType.type !== "void", outParams.length);
        writeOutParams(outParams, outValues);
        return unwrapValue(returnType, primary);
    };
}
