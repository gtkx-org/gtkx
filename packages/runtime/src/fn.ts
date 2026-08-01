import type { Descriptor, Ref } from "@gtkx/native";
import { type Arg, isCallerAllocatedArg, isInoutArg, isOutputArg, isRefArg } from "./arg.js";
import { bind } from "./bind.js";
import { wrapCallbackValue } from "./callback.js";
import { boxedT, refT } from "./descriptors.js";
import { checkError } from "./error.js";
import { LIB } from "./library.js";
import { fromNative } from "./native-value.js";
import { getHandle } from "./registry.js";
import { packTupleResult } from "./tuple.js";

/** The signature a native function is bound against. */
type FnSpec = {
    /** The C arguments in declaration order, including the ones the callee writes into. */
    args: Arg[];
    /** Descriptor for the C return value, packed first when output arguments are also returned. */
    returns: Descriptor;
    /** The function takes a trailing `GError**`, whose contents are thrown as an error on return. */
    canThrow?: boolean;
};

type ArgSpec = {
    arg: Arg;
    isRef: boolean;
    isCallerAllocated: boolean;
    requiresInput: boolean;
    inputIndex: number;
    isOutParam: boolean;
};

const buildNativeArgTypes = (args: Arg[], canThrow: boolean): Descriptor[] => {
    const nativeArgTypes = args.map((argSpec) =>
        argSpec.direction !== undefined && argSpec.isCallerAllocated !== true ? refT(argSpec.type) : argSpec.type,
    );

    if (canThrow) {
        nativeArgTypes.push(
            refT(boxedT("GError", { ownership: "full", sharedLibrary: LIB, getTypeFnName: "g_error_get_type" })),
        );
    }

    return nativeArgTypes;
};

const buildArgSpecs = (args: Arg[]): ArgSpec[] => {
    let inputCursor = 0;

    return args.map((arg) => {
        const isRef = isRefArg(arg);
        const requiresInput = !isRef || isInoutArg(arg);
        const isOutParam = isOutputArg(arg) && arg.isConsumed !== true;

        return {
            arg,
            isRef,
            isCallerAllocated: isCallerAllocatedArg(arg),
            requiresInput,
            inputIndex: requiresInput ? inputCursor++ : -1,
            isOutParam,
        };
    });
};

const resolveCallerAllocated = (inputs: unknown[], inputIndex: number): unknown => {
    const wrapper = inputs[inputIndex];

    return wrapper == null ? wrapper : getHandle(wrapper);
};

const buildRefValue = (requiresInput: boolean, inputs: unknown[], inputIndex: number): Ref => ({
    value: requiresInput ? inputs[inputIndex] : null,
});

const buildNativeValue = (spec: ArgSpec, inputs: unknown[]): unknown => {
    const { arg, isRef, isCallerAllocated, requiresInput, inputIndex } = spec;

    if (isCallerAllocated) {
        return resolveCallerAllocated(inputs, inputIndex);
    }

    if (isRef) {
        return buildRefValue(requiresInput, inputs, inputIndex);
    }

    if (arg.type.kind === "callback") {
        return wrapCallbackValue(arg.type, inputs[inputIndex]);
    }

    return inputs[inputIndex];
};

const buildNativeValues = (plans: ArgSpec[], inputs: unknown[]): unknown[] =>
    plans.map((plan) => buildNativeValue(plan, inputs));

const readOutParams = (plans: ArgSpec[], inputs: unknown[], nativeValues: unknown[]): unknown[] => {
    const outParams: unknown[] = [];

    for (const [index, { arg, isCallerAllocated, inputIndex, isOutParam }] of plans.entries()) {
        if (!isOutParam) {
            continue;
        }

        outParams.push(
            isCallerAllocated ? inputs[inputIndex] : fromNative(arg.type, (nativeValues[index] as Ref).value),
        );
    }

    return outParams;
};

function fn(sharedLibrary: string, symbol: string, spec: FnSpec): (...inputs: unknown[]) => unknown {
    const { args, returns: returnDescriptor, canThrow = false } = spec;
    const nativeArgTypes = buildNativeArgTypes(args, canThrow);
    const nativeFn = bind(sharedLibrary, symbol, nativeArgTypes, returnDescriptor);
    const hasPrimary = returnDescriptor.kind !== "void";
    const plans = buildArgSpecs(args);

    const shape = (inputs: unknown[], nativeValues: unknown[], nativeResult: unknown): unknown => {
        const primary = hasPrimary ? fromNative(returnDescriptor, nativeResult) : undefined;

        return packTupleResult(readOutParams(plans, inputs, nativeValues), primary, hasPrimary);
    };

    if (canThrow) {
        return (...inputs) => {
            const nativeValues = buildNativeValues(plans, inputs);
            const errorRef: Ref = { value: null };
            nativeValues.push(errorRef);
            const nativeResult = nativeFn(...nativeValues);
            checkError(errorRef);

            return shape(inputs, nativeValues, nativeResult);
        };
    }

    return (...inputs) => {
        const nativeValues = buildNativeValues(plans, inputs);

        return shape(inputs, nativeValues, nativeFn(...nativeValues));
    };
}

export { fn };
