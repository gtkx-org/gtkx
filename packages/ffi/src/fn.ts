import type { CallbackType, Ref, Type, Value } from "@gtkx/native";
import { type ArgCategory, classifyArgCategory } from "./arg-category.js";
import { LIB } from "./constants.js";
import { bind, boxedT, refT } from "./descriptors.js";
import { checkError } from "./gerror.js";
import { type UserHandler, wrapHandler } from "./handler-trampoline.js";
import { getHandle } from "./registry.js";
import { wrapValue } from "./wrap-value.js";

const wrapCallbackValue = (spec: CallbackType, callback: unknown): Value =>
    callback == null ? (callback as Value) : wrapHandler(callback as UserHandler, spec, "none");

export type ArgType = {
    type: Type;
    direction?: "out" | "inout";
    callerAllocates?: boolean;
    consumed?: boolean;
};

export type FnSignature = {
    args: ArgType[];
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

const toNativeArgTypes = (argTypes: ArgType[], throws: boolean): Type[] => {
    const nativeArgTypes = argTypes.map((argType) =>
        argType.direction !== undefined && argType.callerAllocates !== true ? refT(argType.type) : argType.type,
    );
    if (throws)
        nativeArgTypes.push(refT(boxedT("GError", { ownership: "full", library: LIB, getTypeFn: "g_error_get_type" })));
    return nativeArgTypes;
};

type ArgPlan = {
    argType: ArgType;
    category: ArgCategory;
    consumesInput: boolean;
    inputIndex: number;
    isOutput: boolean;
};

const categoryOf = (argType: ArgType): ArgCategory =>
    classifyArgCategory({ direction: argType.direction, callerAllocated: argType.callerAllocates === true });

const planArgs = (argTypes: ArgType[]): ArgPlan[] => {
    let inputCursor = 0;
    return argTypes.map((argType) => {
        const category = categoryOf(argType);
        const consumesInput = category.kind !== "outCell" || category.inout;
        const isOutput = category.kind !== "plainInput" && argType.consumed !== true;
        return { argType, category, consumesInput, inputIndex: consumesInput ? inputCursor++ : -1, isOutput };
    });
};

const toNativeValues = (plans: ArgPlan[], inputs: unknown[]): Value[] =>
    plans.map(({ argType, category, consumesInput, inputIndex }) => {
        if (category.kind === "callerAllocated") {
            const wrapper = inputs[inputIndex];
            return wrapper == null ? wrapper : getHandle(wrapper as object);
        }
        if (category.kind === "outCell") {
            return { value: consumesInput ? (inputs[inputIndex] as Value) : null };
        }
        if (argType.type.type === "callback") {
            return wrapCallbackValue(argType.type, inputs[inputIndex]);
        }
        return inputs[inputIndex] as Value;
    });

const toOutputs = (plans: ArgPlan[], inputs: unknown[], nativeValues: Value[]): unknown[] => {
    const outputs: unknown[] = [];
    plans.forEach(({ argType, category, inputIndex, isOutput }, index) => {
        if (!isOutput) return;
        outputs.push(
            category.kind === "callerAllocated"
                ? inputs[inputIndex]
                : wrapValue(argType.type, (nativeValues[index] as Ref).value),
        );
    });
    return outputs;
};

export function fn(library: string, symbol: string, signature: FnSignature): (...inputs: unknown[]) => unknown {
    const { args: argTypes, returns: returnType, throws = false } = signature;
    const nativeArgTypes = toNativeArgTypes(argTypes, throws);
    const nativeFn = bind(library, symbol, nativeArgTypes, returnType);
    const hasPrimary = returnType.type !== "void";
    const plans = planArgs(argTypes);

    const shape = (inputs: unknown[], nativeValues: Value[], nativeResult: Value): unknown => {
        const primary = hasPrimary ? wrapValue(returnType, nativeResult) : undefined;
        return tupleResult(toOutputs(plans, inputs, nativeValues), primary, hasPrimary);
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
