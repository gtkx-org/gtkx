import type { Descriptor, Ref } from "@gtkx/native";
import { type Arg, isCallerAllocatedArg, isInoutArg, isOutputArg, isRefArg } from "./arg.js";
import { bind } from "./bind.js";
import { wrapCallbackValue } from "./callback.js";
import { boxedT, refT } from "./descriptors.js";
import { checkError } from "./error.js";
import { LIB } from "./library.js";
import { fromNativeValue } from "./native-value.js";
import { getHandle } from "./registry.js";
import { packTupleResult } from "./tuple.js";

type FnSpec = {
    args: Arg[];
    returns: Descriptor;
    throws?: boolean;
};

type ArgSpec = {
    arg: Arg;
    isRef: boolean;
    isCallerAllocated: boolean;
    consumesInput: boolean;
    inputIndex: number;
    isOutParam: boolean;
};

const toNativeArgTypes = (args: Arg[], throws: boolean): Descriptor[] => {
    const nativeArgTypes = args.map((argSpec) =>
        argSpec.direction !== undefined && argSpec.callerAllocated !== true ? refT(argSpec.type) : argSpec.type,
    );
    if (throws)
        nativeArgTypes.push(
            refT(boxedT("GError", { ownership: "full", sharedLibrary: LIB, getTypeFnName: "g_error_get_type" })),
        );
    return nativeArgTypes;
};

const toArgSpecs = (args: Arg[]): ArgSpec[] => {
    let inputCursor = 0;
    return args.map((arg) => {
        const isRef = isRefArg(arg);
        const consumesInput = !isRef || isInoutArg(arg);
        const isOutParam = isOutputArg(arg) && arg.consumed !== true;
        return {
            arg,
            isRef,
            isCallerAllocated: isCallerAllocatedArg(arg),
            consumesInput,
            inputIndex: consumesInput ? inputCursor++ : -1,
            isOutParam,
        };
    });
};

const toNativeValues = (plans: ArgSpec[], inputs: unknown[]): unknown[] =>
    plans.map(({ arg, isRef, isCallerAllocated, consumesInput, inputIndex }) => {
        if (isCallerAllocated) {
            const wrapper = inputs[inputIndex];
            return wrapper == null ? wrapper : getHandle(wrapper as object);
        }
        if (isRef) {
            return { value: consumesInput ? inputs[inputIndex] : null };
        }
        if (arg.type.kind === "callback") {
            return wrapCallbackValue(arg.type, inputs[inputIndex]);
        }
        return inputs[inputIndex];
    });

const toOutParams = (plans: ArgSpec[], inputs: unknown[], nativeValues: unknown[]): unknown[] => {
    const outParams: unknown[] = [];
    plans.forEach(({ arg, isCallerAllocated, inputIndex, isOutParam }, index) => {
        if (!isOutParam) return;
        outParams.push(
            isCallerAllocated ? inputs[inputIndex] : fromNativeValue(arg.type, (nativeValues[index] as Ref).value),
        );
    });
    return outParams;
};

export function fn(sharedLibrary: string, symbol: string, spec: FnSpec): (...inputs: unknown[]) => unknown {
    const { args, returns: returnDescriptor, throws = false } = spec;
    const nativeArgTypes = toNativeArgTypes(args, throws);
    const nativeFn = bind(sharedLibrary, symbol, nativeArgTypes, returnDescriptor);
    const hasPrimary = returnDescriptor.kind !== "void";
    const plans = toArgSpecs(args);

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
