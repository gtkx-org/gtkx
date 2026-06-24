import type { CallbackType, Ref, Type, Value } from "@gtkx/native";
import { type ArgCategory, classifyArgCategory } from "./arg-category.js";
import { LIB } from "./constants.js";
import { bind, boxedT, refT } from "./descriptors.js";
import { checkError } from "./gerror.js";
import { type UserCallback, wrapCallback } from "./callback.js";
import { getHandle } from "./registry.js";
import { wrapValue } from "./wrap-value.js";

const wrapCallbackValue = (spec: CallbackType, callback: unknown): Value =>
    callback == null ? (callback as Value) : wrapCallback(callback as UserCallback, spec, "none");

export type ArgSpec = {
    type: Type;
    direction?: "out" | "inout";
    callerAllocates?: boolean;
    consumed?: boolean;
};

export type FnSignature = {
    args: ArgSpec[];
    returns: Type;
    throws?: boolean;
};

export const tupleResult = (outs: unknown[], primary: unknown, hasPrimary: boolean): unknown => {
    if (hasPrimary) {
        return outs.length === 0 ? primary : [primary, ...outs];
    }
    if (outs.length === 0) return undefined;
    if (outs.length === 1) return outs[0];
    return outs;
};

const toNativeArgTypes = (argSpecs: ArgSpec[], throws: boolean): Type[] => {
    const nativeArgTypes = argSpecs.map((argSpec) =>
        argSpec.direction !== undefined && argSpec.callerAllocates !== true ? refT(argSpec.type) : argSpec.type,
    );
    if (throws)
        nativeArgTypes.push(refT(boxedT("GError", { ownership: "full", library: LIB, getTypeFn: "g_error_get_type" })));
    return nativeArgTypes;
};

type ArgPlan = {
    argSpec: ArgSpec;
    category: ArgCategory;
    consumesInput: boolean;
    inputIndex: number;
    isOutParam: boolean;
};

const categoryOfArgSpec = (argSpec: ArgSpec): ArgCategory =>
    classifyArgCategory({ direction: argSpec.direction, callerAllocated: argSpec.callerAllocates === true });

const planArgs = (argSpecs: ArgSpec[]): ArgPlan[] => {
    let inputCursor = 0;
    return argSpecs.map((argSpec) => {
        const category = categoryOfArgSpec(argSpec);
        const consumesInput = category.kind !== "outCell" || category.inout;
        const isOutParam = category.kind !== "plainInput" && argSpec.consumed !== true;
        return { argSpec, category, consumesInput, inputIndex: consumesInput ? inputCursor++ : -1, isOutParam };
    });
};

const toNativeValues = (plans: ArgPlan[], inputs: unknown[]): Value[] =>
    plans.map(({ argSpec, category, consumesInput, inputIndex }) => {
        if (category.kind === "callerAllocated") {
            const wrapper = inputs[inputIndex];
            return wrapper == null ? wrapper : getHandle(wrapper as object);
        }
        if (category.kind === "outCell") {
            return { value: consumesInput ? (inputs[inputIndex] as Value) : null };
        }
        if (argSpec.type.type === "callback") {
            return wrapCallbackValue(argSpec.type, inputs[inputIndex]);
        }
        return inputs[inputIndex] as Value;
    });

const toOutParams = (plans: ArgPlan[], inputs: unknown[], nativeValues: Value[]): unknown[] => {
    const outParams: unknown[] = [];
    plans.forEach(({ argSpec, category, inputIndex, isOutParam }, index) => {
        if (!isOutParam) return;
        outParams.push(
            category.kind === "callerAllocated"
                ? inputs[inputIndex]
                : wrapValue(argSpec.type, (nativeValues[index] as Ref).value),
        );
    });
    return outParams;
};

export function fn(library: string, symbol: string, signature: FnSignature): (...inputs: unknown[]) => unknown {
    const { args: argSpecs, returns: returnType, throws = false } = signature;
    const nativeArgTypes = toNativeArgTypes(argSpecs, throws);
    const nativeFn = bind(library, symbol, nativeArgTypes, returnType);
    const hasPrimary = returnType.type !== "void";
    const plans = planArgs(argSpecs);

    const shape = (inputs: unknown[], nativeValues: Value[], nativeResult: Value): unknown => {
        const primary = hasPrimary ? wrapValue(returnType, nativeResult) : undefined;
        return tupleResult(toOutParams(plans, inputs, nativeValues), primary, hasPrimary);
    };

    if (throws) {
        return (...inputs) => {
            const nativeValues = toNativeValues(plans, inputs);
            const errorCell: Ref = { value: null };
            nativeValues.push(errorCell);
            const nativeResult = nativeFn(...nativeValues);
            checkError(errorCell);
            return shape(inputs, nativeValues, nativeResult);
        };
    }

    return (...inputs) => {
        const nativeValues = toNativeValues(plans, inputs);
        return shape(inputs, nativeValues, nativeFn(...nativeValues));
    };
}
