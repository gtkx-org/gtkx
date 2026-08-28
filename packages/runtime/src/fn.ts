import type { CallDescriptor, Descriptor, ExternalObject, Handle, Ref } from "@gtkx/native";
import { call, bind as nativeBind } from "@gtkx/native";
import type { RefSeeds } from "./vfunc-seeds.js";
import { type Arg, isCallerAllocatedArg, isOutputArg, isRefArg, isUnpackedArg, requiresInputArg } from "./arg.js";
import { wrapCallbackValue } from "./callback.js";
import { boxedT, isGtypeDescriptor, refT } from "./descriptors.js";
import { checkError } from "./error.js";
import { LIB } from "./library.js";
import { fromNative, toNative } from "./native-value.js";
import { getHandle } from "./registry.js";
import { hasSurfacedPrimary, packTupleResult } from "./tuple.js";
import { TYPE_INVALID } from "./type.js";
import { fromValue, getValueType } from "./value.js";

/** The signature a native function is bound against. */
type FnSpec = {
    /** The C arguments in declaration order, including the ones the callee writes into. */
    args: Arg[];
    /** Descriptor for the C return value, packed first when output arguments are also returned. */
    returns: Descriptor;
    /**
     * The callee returns a value the bindings do not surface, so the call is made against the
     * declared return type and the value is dropped instead of being packed into the result.
     */
    isReturnSkipped?: boolean;
    /** The function takes a trailing `GError**`, whose contents are thrown as an error on return. */
    canThrow?: boolean;
    /**
     * How many of `args` precede the callee's ellipsis, marking it variadic. Omitting it binds a
     * fixed-arity call, which passes the wrong argument classes to a variadic callee on some
     * architectures.
     */
    fixedArgCount?: number;
    /** The callee returns a `GValue`, surfaced as what it holds rather than as the value itself. */
    isReturnUnpacked?: boolean;
};

type ArgSpec = {
    arg: Arg;
    index: number;
    isRef: boolean;
    isCallerAllocated: boolean;
    isUnpacked: boolean;
    requiresInput: boolean;
    inputIndex: number;
    isOutParam: boolean;
    carriesGtype: boolean;
};

const NO_OUT_PARAMS: unknown[] = [];

const hasGtypeInput = (descriptor: Descriptor): boolean =>
    isGtypeDescriptor(descriptor) || (descriptor.kind === "array" && isGtypeDescriptor(descriptor.itemDescriptor));

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
            isUnpacked: isUnpackedArg(arg),
            requiresInput,
            inputIndex: requiresInput ? inputCursor++ : -1,
            isOutParam,
            carriesGtype: hasGtypeInput(arg.type),
        };
    });
};

const resolveCallerAllocated = (inputs: unknown[], inputIndex: number): unknown => {
    const wrapper = inputs[inputIndex];

    return wrapper == null ? wrapper : getHandle(wrapper);
};

const inputValueFor = (spec: ArgSpec, inputs: unknown[]): unknown =>
    spec.carriesGtype ? toNative(spec.arg.type, inputs[spec.inputIndex]) : inputs[spec.inputIndex];

const buildRefValue = (spec: ArgSpec, inputs: unknown[], seeds: RefSeeds | undefined): Ref => ({
    value: spec.requiresInput ? inputValueFor(spec, inputs) : (seeds?.get(spec.index) ?? null),
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

    return inputValueFor(spec, inputs);
};

const buildNativeValues = (plans: ArgSpec[], inputs: unknown[], seeds: RefSeeds | undefined): unknown[] =>
    plans.map((plan) => buildNativeValue(plan, inputs, seeds));

const unpackValueHandle = (handle: ExternalObject<Handle> | null): unknown => {
    if (handle === null || getValueType(handle) === TYPE_INVALID) {
        return null;
    }

    return fromValue(handle);
};

const readCallerAllocated = (plan: ArgSpec, inputs: unknown[]): unknown => {
    const wrapper = inputs[plan.inputIndex];

    if (!plan.isUnpacked) {
        return wrapper;
    }

    return unpackValueHandle(wrapper == null ? null : getHandle(wrapper));
};

const readOutParams = (outPlans: ArgSpec[], inputs: unknown[], nativeValues: unknown[]): unknown[] => {
    if (outPlans.length === 0) {
        return NO_OUT_PARAMS;
    }

    return Array.from(outPlans, (plan) =>
        plan.isCallerAllocated
            ? readCallerAllocated(plan, inputs)
            : fromNative(plan.arg.type, (nativeValues[plan.index] as Ref).value));
};

const isPassThroughPlan = (plan: ArgSpec, index: number): boolean =>
    plan.inputIndex === index &&
    !plan.isRef &&
    !plan.isCallerAllocated &&
    !plan.carriesGtype &&
    plan.arg.type.kind !== "callback";

const requiredInputIndices = (plans: ArgSpec[]): number[] =>
    plans.filter((plan) => plan.requiresInput && plan.arg.isRequired === true).map((plan) => plan.inputIndex);

const assertRequiredInputs = (requiredIndices: number[], inputs: unknown[]): void => {
    for (const index of requiredIndices) {
        if (inputs[index] === undefined) {
            throw new TypeError(`Missing required argument at position ${String(index + 1)}`);
        }
    }
};

const resizeInputs = (inputs: unknown[], argCount: number): unknown[] => {
    while (inputs.length < argCount) {
        inputs.push(undefined);
    }

    if (inputs.length > argCount) {
        inputs.length = argCount;
    }

    return inputs;
};

const returnReader = (spec: FnSpec): ((nativeResult: unknown) => unknown) =>
    spec.isReturnUnpacked === true
        ? (nativeResult) => unpackValueHandle((nativeResult ?? null) as ExternalObject<Handle> | null)
        : (nativeResult) => fromNative(spec.returns, nativeResult);

const directCallable = (
    descriptor: ExternalObject<CallDescriptor>,
    readReturn: (nativeResult: unknown) => unknown,
    hasPrimary: boolean,
    plans: ArgSpec[],
): ((...inputs: unknown[]) => unknown) => {
    const argCount = plans.length;
    const requiredIndices = requiredInputIndices(plans);

    const marshal = (inputs: unknown[]): unknown => {
        assertRequiredInputs(requiredIndices, inputs);

        return readReturn(call(descriptor, resizeInputs(inputs, argCount)));
    };

    if (hasPrimary) {
        return (...inputs) => marshal(inputs);
    }

    return (...inputs) => {
        marshal(inputs);
    };
};

function fromNativeCallable(
    descriptor: ExternalObject<CallDescriptor>,
    spec: FnSpec,
    getRefSeeds?: () => RefSeeds | undefined,
): (...inputs: unknown[]) => unknown {
    const { args, returns: returnDescriptor, canThrow = false } = spec;
    const hasPrimary = hasSurfacedPrimary(returnDescriptor, spec.isReturnSkipped);
    const plans = buildArgSpecs(args);
    const outPlans = plans.filter((plan) => plan.isOutParam);
    const arePassThrough = plans.every((plan, index) => isPassThroughPlan(plan, index));
    const readReturn = returnReader(spec);

    if (!canThrow && arePassThrough) {
        return directCallable(descriptor, readReturn, hasPrimary, plans);
    }

    const requiredIndices = requiredInputIndices(plans);

    const shape = (inputs: unknown[], nativeValues: unknown[], nativeResult: unknown): unknown =>
        packTupleResult(readOutParams(outPlans, inputs, nativeValues), readReturn(nativeResult), hasPrimary);

    if (canThrow) {
        return (...inputs) => {
            assertRequiredInputs(requiredIndices, inputs);
            const nativeValues = buildNativeValues(plans, inputs, getRefSeeds?.());
            const errorRef: Ref = { value: null };
            nativeValues.push(errorRef);
            const nativeResult = call(descriptor, nativeValues);
            checkError(errorRef);

            return shape(inputs, nativeValues, nativeResult);
        };
    }

    return (...inputs) => {
        assertRequiredInputs(requiredIndices, inputs);
        const nativeValues = buildNativeValues(plans, inputs, getRefSeeds?.());

        return shape(inputs, nativeValues, call(descriptor, nativeValues));
    };
}

const bindNativeCallable = (
    sharedLibrary: string,
    symbol: string,
    spec: FnSpec,
): ((...inputs: unknown[]) => unknown) => {
    const nativeArgTypes = buildNativeArgTypes(spec.args, spec.canThrow ?? false);
    const descriptor = nativeBind(sharedLibrary, symbol, nativeArgTypes, spec.returns, spec.fixedArgCount);

    return fromNativeCallable(descriptor, spec);
};

/**
 * Binds a symbol in a shared library to a callable that marshals its inputs and packs output
 * arguments into the result. When the spec sets `canThrow`, the reported `GError` is thrown.
 *
 * A plain spec is bound when `fn` is called, so a malformed descriptor throws at binding time.
 * Passing a function returning the spec instead defers building the descriptors and the binding
 * to the first call, so describing such a binding costs nothing until something calls it and a
 * module full of them loads without touching the shared library.
 *
 * @param sharedLibrary Shared library the symbol is looked up in.
 * @param symbol Name of the C symbol to bind.
 * @param spec Argument and return descriptors the call is marshalled through, or a function
 * returning them, which defers building the descriptors and the binding to the first call.
 */
function fn(
    sharedLibrary: string,
    symbol: string,
    spec: FnSpec | (() => FnSpec),
): (...inputs: unknown[]) => unknown {
    if (typeof spec !== "function") {
        return bindNativeCallable(sharedLibrary, symbol, spec);
    }

    let bound: ((...inputs: unknown[]) => unknown) | undefined;

    return (...inputs) => {
        bound ??= bindNativeCallable(sharedLibrary, symbol, spec());

        return bound(...inputs);
    };
}

export { buildNativeArgTypes, fn, fromNativeCallable };
