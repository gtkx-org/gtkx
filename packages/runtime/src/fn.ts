import type { CallDescriptor, Descriptor, ExternalObject, Ref } from "@gtkx/native";
import { call, bind as nativeBind } from "@gtkx/native";
import type { RefSeeds } from "./vfunc-seeds.js";
import { type Arg, isCallerAllocatedArg, isOutputArg, isRefArg, requiresInputArg } from "./arg.js";
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
    /**
     * How many of `args` precede the callee's ellipsis, marking it variadic. Omitting it binds a
     * fixed-arity call, which passes the wrong argument classes to a variadic callee on some
     * architectures.
     */
    fixedArgCount?: number;
};

type ArgSpec = {
    arg: Arg;
    index: number;
    isRef: boolean;
    isCallerAllocated: boolean;
    requiresInput: boolean;
    inputIndex: number;
    isOutParam: boolean;
};

const NO_OUT_PARAMS: unknown[] = [];

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

    return args.map((arg, index) => {
        const isRef = isRefArg(arg);
        const requiresInput = requiresInputArg(arg);
        const isOutParam = isOutputArg(arg) && arg.isConsumed !== true;

        return {
            arg,
            index,
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

const buildRefValue = (spec: ArgSpec, inputs: unknown[], seeds: RefSeeds | undefined): Ref => ({
    value: spec.requiresInput ? inputs[spec.inputIndex] : (seeds?.get(spec.index) ?? null),
});

const buildNativeValue = (spec: ArgSpec, inputs: unknown[], seeds: RefSeeds | undefined): unknown => {
    const { arg, isRef, isCallerAllocated, inputIndex } = spec;

    if (isCallerAllocated) {
        return resolveCallerAllocated(inputs, inputIndex);
    }

    if (isRef) {
        return buildRefValue(spec, inputs, seeds);
    }

    if (arg.type.kind === "callback") {
        return wrapCallbackValue(arg.type, inputs[inputIndex]);
    }

    return inputs[inputIndex];
};

const buildNativeValues = (plans: ArgSpec[], inputs: unknown[], seeds: RefSeeds | undefined): unknown[] =>
    plans.map((plan) => buildNativeValue(plan, inputs, seeds));

const readOutParams = (outPlans: ArgSpec[], inputs: unknown[], nativeValues: unknown[]): unknown[] => {
    if (outPlans.length === 0) {
        return NO_OUT_PARAMS;
    }

    return Array.from(outPlans, (plan) =>
        plan.isCallerAllocated
            ? inputs[plan.inputIndex]
            : fromNative(plan.arg.type, (nativeValues[plan.index] as Ref).value));
};

const isPassThroughPlan = (plan: ArgSpec, index: number): boolean =>
    plan.inputIndex === index &&
    !plan.isRef &&
    !plan.isCallerAllocated &&
    plan.arg.type.kind !== "callback";

const resizeInputs = (inputs: unknown[], argCount: number): unknown[] => {
    while (inputs.length < argCount) {
        inputs.push(undefined);
    }

    if (inputs.length > argCount) {
        inputs.length = argCount;
    }

    return inputs;
};

const directCallable = (
    descriptor: ExternalObject<CallDescriptor>,
    returnDescriptor: Descriptor,
    argCount: number,
): ((...inputs: unknown[]) => unknown) => {
    if (returnDescriptor.kind === "void") {
        return (...inputs) => {
            call(descriptor, resizeInputs(inputs, argCount));
        };
    }

    return (...inputs) => fromNative(returnDescriptor, call(descriptor, resizeInputs(inputs, argCount)));
};

function fromNativeCallable(
    descriptor: ExternalObject<CallDescriptor>,
    spec: FnSpec,
    getRefSeeds?: () => RefSeeds | undefined,
): (...inputs: unknown[]) => unknown {
    const { args, returns: returnDescriptor, canThrow = false } = spec;
    const hasPrimary = returnDescriptor.kind !== "void";
    const plans = buildArgSpecs(args);
    const outPlans = plans.filter((plan) => plan.isOutParam);
    const arePassThrough = plans.every((plan, index) => isPassThroughPlan(plan, index));

    if (!canThrow && arePassThrough) {
        return directCallable(descriptor, returnDescriptor, plans.length);
    }

    const shape = (inputs: unknown[], nativeValues: unknown[], nativeResult: unknown): unknown => {
        const primary = hasPrimary ? fromNative(returnDescriptor, nativeResult) : undefined;

        return packTupleResult(readOutParams(outPlans, inputs, nativeValues), primary, hasPrimary);
    };

    if (canThrow) {
        return (...inputs) => {
            const nativeValues = buildNativeValues(plans, inputs, getRefSeeds?.());
            const errorRef: Ref = { value: null };
            nativeValues.push(errorRef);
            const nativeResult = call(descriptor, nativeValues);
            checkError(errorRef);

            return shape(inputs, nativeValues, nativeResult);
        };
    }

    return (...inputs) => {
        const nativeValues = buildNativeValues(plans, inputs, getRefSeeds?.());

        return shape(inputs, nativeValues, call(descriptor, nativeValues));
    };
}

/**
 * Binds a symbol in a shared library to a callable that marshals its inputs and packs output
 * arguments into the result. When the spec sets `canThrow`, the reported `GError` is thrown.
 *
 * @param sharedLibrary Shared library the symbol is looked up in.
 * @param symbol Name of the C symbol to bind.
 * @param spec Argument and return descriptors the call is marshalled through.
 */
function fn(sharedLibrary: string, symbol: string, spec: FnSpec): (...inputs: unknown[]) => unknown {
    const nativeArgTypes = buildNativeArgTypes(spec.args, spec.canThrow ?? false);
    const descriptor = nativeBind(sharedLibrary, symbol, nativeArgTypes, spec.returns, spec.fixedArgCount);

    return fromNativeCallable(descriptor, spec);
}

export { buildNativeArgTypes, fn, fromNativeCallable };
