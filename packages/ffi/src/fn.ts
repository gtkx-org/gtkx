import type { Descriptor } from "@gtkx/native";
import { isCallerAllocatedArg, isInoutArg, isOutputArg, isRefArg } from "./arg.js";
import { type UserCallback, wrapCallback } from "./callback.js";
import { LIB } from "./constants.js";
import { bind, boxedT, type CallbackDescriptor, type Ref, refT } from "./descriptors.js";
import { checkError } from "./gerror.js";
import { fromNativeValue } from "./native-value.js";
import { getHandle } from "./registry.js";
import { packTupleResult } from "./tuple.js";

const wrapCallbackValue = (spec: CallbackDescriptor, callback: unknown): unknown =>
    callback == null ? callback : wrapCallback(callback as UserCallback, spec, "none");

type ArgSpec = {
    type: Descriptor;
    direction?: "out" | "inout";
    callerAllocated?: boolean;
    consumed?: boolean;
};

type FnSignature = {
    args: ArgSpec[];
    returns: Descriptor;
    throws?: boolean;
};

const toNativeArgTypes = (argSpecs: ArgSpec[], throws: boolean): Descriptor[] => {
    const nativeArgTypes = argSpecs.map((argSpec) =>
        argSpec.direction !== undefined && argSpec.callerAllocated !== true ? refT(argSpec.type) : argSpec.type,
    );
    if (throws)
        nativeArgTypes.push(
            refT(boxedT("GError", { ownership: "full", sharedLibrary: LIB, getTypeFnName: "g_error_get_type" })),
        );
    return nativeArgTypes;
};

type ArgPlan = {
    argSpec: ArgSpec;
    isRef: boolean;
    isCallerAllocated: boolean;
    consumesInput: boolean;
    inputIndex: number;
    isOutParam: boolean;
};

const planArgs = (argSpecs: ArgSpec[]): ArgPlan[] => {
    let inputCursor = 0;
    return argSpecs.map((argSpec) => {
        const isRef = isRefArg(argSpec);
        const consumesInput = !isRef || isInoutArg(argSpec);
        const isOutParam = isOutputArg(argSpec) && argSpec.consumed !== true;
        return {
            argSpec,
            isRef,
            isCallerAllocated: isCallerAllocatedArg(argSpec),
            consumesInput,
            inputIndex: consumesInput ? inputCursor++ : -1,
            isOutParam,
        };
    });
};

const toNativeValues = (plans: ArgPlan[], inputs: unknown[]): unknown[] =>
    plans.map(({ argSpec, isRef, isCallerAllocated, consumesInput, inputIndex }) => {
        if (isCallerAllocated) {
            const wrapper = inputs[inputIndex];
            return wrapper == null ? wrapper : getHandle(wrapper as object);
        }
        if (isRef) {
            return { value: consumesInput ? inputs[inputIndex] : null };
        }
        if (argSpec.type.kind === "callback") {
            return wrapCallbackValue(argSpec.type, inputs[inputIndex]);
        }
        return inputs[inputIndex];
    });

const toOutParams = (plans: ArgPlan[], inputs: unknown[], nativeValues: unknown[]): unknown[] => {
    const outParams: unknown[] = [];
    plans.forEach(({ argSpec, isCallerAllocated, inputIndex, isOutParam }, index) => {
        if (!isOutParam) return;
        outParams.push(
            isCallerAllocated ? inputs[inputIndex] : fromNativeValue(argSpec.type, (nativeValues[index] as Ref).value),
        );
    });
    return outParams;
};

export function fn(sharedLibrary: string, symbol: string, signature: FnSignature): (...inputs: unknown[]) => unknown {
    const { args: argSpecs, returns: returnDescriptor, throws = false } = signature;
    const nativeArgTypes = toNativeArgTypes(argSpecs, throws);
    const nativeFn = bind(sharedLibrary, symbol, nativeArgTypes, returnDescriptor);
    const hasPrimary = returnDescriptor.kind !== "void";
    const plans = planArgs(argSpecs);

    const shape = (inputs: unknown[], nativeValues: unknown[], nativeResult: unknown): unknown => {
        const primary = hasPrimary ? fromNativeValue(returnDescriptor, nativeResult) : undefined;
        return packTupleResult(toOutParams(plans, inputs, nativeValues), primary, hasPrimary);
    };

    if (throws) {
        return (...inputs) => {
            const nativeValues = toNativeValues(plans, inputs);
            const errorRef: Ref = { value: null };
            nativeValues.push(errorRef);
            const nativeResult = nativeFn(...nativeValues);
            checkError(errorRef);
            return shape(inputs, nativeValues, nativeResult);
        };
    }

    return (...inputs) => {
        const nativeValues = toNativeValues(plans, inputs);
        return shape(inputs, nativeValues, nativeFn(...nativeValues));
    };
}
