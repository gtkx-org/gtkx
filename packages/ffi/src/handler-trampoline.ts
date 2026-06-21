import type { Type as FfiType, RefType, Value } from "@gtkx/native";
import { type ArgCategory, type ArgDirectionMeta, classifyArgCategory } from "./arg-category.js";
import { valueCopyInto } from "./gvalue.js";
import { getHandle } from "./registry.js";
import { unwrapValue, wrapValue } from "./wrap-value.js";

const isOutCell = (argType: FfiType): argType is RefType => argType.type === "ref";

const isCallerAllocatedBuffer = (argType: FfiType): boolean =>
    (argType.type === "boxed" || argType.type === "struct") && argType.callerAllocated === true;

const argDirectionMetaOf = (argType: FfiType): ArgDirectionMeta => {
    if (isOutCell(argType)) return { direction: argType.inout === true ? "inout" : "out", callerAllocated: false };
    if (isCallerAllocatedBuffer(argType)) return { direction: "out", callerAllocated: true };
    return { callerAllocated: false };
};

const categoryOf = (argType: FfiType): ArgCategory => classifyArgCategory(argDirectionMetaOf(argType));

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

const fillCallerAllocatedBuffer = (argType: FfiType, target: object, source: object): void => {
    if (argType.type === "boxed" && argType.innerType === "GValue") {
        valueCopyInto(getHandle(target), getHandle(source));
        return;
    }
    copyBoxedFields(target, source);
};

const splitHandlerResult = (
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

export type HandlerReceiver = "this" | "skip" | "none";

export type Handler = (...args: Value[]) => Value;

export type UserHandler = (...args: never[]) => unknown;

export type HandlerSpec = {
    argTypes: FfiType[];
    returnType: FfiType;
    userDataIndex?: number;
};

type OutParam = { value: unknown; argType: FfiType };

const partitionHandlerArgs = (
    effectiveTypes: FfiType[],
    wrapped: unknown[],
    start: number,
    receiver: HandlerReceiver,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const outParams: OutParam[] = [];
    for (let i = start; i < effectiveTypes.length; i++) {
        const argType = effectiveTypes[i];
        const category: ArgCategory = argType === undefined ? { kind: "plainInput" } : categoryOf(argType);
        if (argType !== undefined && category.kind === "outCell") {
            if (category.inout) inputs.push((wrapped[i] as { value: unknown }).value);
            outParams.push({ value: wrapped[i], argType });
        } else if (argType !== undefined && category.kind === "callerAllocated" && receiver === "this") {
            outParams.push({ value: wrapped[i], argType });
        } else {
            inputs.push(wrapped[i]);
        }
    }
    return { inputs, outParams };
};

const writeOutParams = (outParams: OutParam[], outValues: unknown[]): void => {
    outParams.forEach((outParam, position) => {
        const outValue = outValues[position];
        if (isOutCell(outParam.argType)) {
            (outParam.value as { value: unknown }).value = outValue;
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(outParam.argType, outParam.value as object, outValue as object);
        }
    });
};

export function wrapHandler(fn: UserHandler, spec: HandlerSpec, receiver: HandlerReceiver): Handler {
    const { returnType, userDataIndex } = spec;
    const effectiveTypes =
        userDataIndex === undefined ? spec.argTypes : spec.argTypes.filter((_, i) => i !== userDataIndex);
    const start = receiver === "none" ? 0 : 1;
    return (...rawArgs: Value[]): Value => {
        const wrapped = effectiveTypes.map((argType, i) => wrapValue(argType, rawArgs[i]));
        const thisArg = receiver === "this" ? (wrapped[0] ?? null) : null;
        const { inputs, outParams } = partitionHandlerArgs(effectiveTypes, wrapped, start, receiver);
        const result = (fn as (this: unknown, ...args: unknown[]) => unknown).apply(thisArg, inputs);
        if (outParams.length === 0) {
            return unwrapValue(returnType, result);
        }
        const { primary, outValues } = splitHandlerResult(result, returnType.type !== "void", outParams.length);
        writeOutParams(outParams, outValues);
        return unwrapValue(returnType, primary);
    };
}
