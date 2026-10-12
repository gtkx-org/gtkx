import { createClosure as createNativeClosure, type ExternalObject, type Handle } from "./native.js";
import { type AnyClass } from "@gtkx/utils";
import { bind } from "./bind.js";
import {
    boxedT,
    bufferT,
    type CallbackDescriptor,
    callbackT,
    sizedArrayT,
    structT,
    uint32T,
    voidT,
} from "./descriptors.js";
import { LIB, VALUE_SIZE, VALUE_T } from "./library.js";
import { describeValueKind, getClassType, getHandle, getWrapperClass, wrapHandle } from "./registry.js";
import { resolveBoxedType, typeIsA } from "./type.js";
import { fromValue, getValueType, intoValue } from "./value.js";
import { compileDescriptor } from "./scalar-plan.js";

/**
 * Handler backing a `GClosure`. It receives the closure's parameters already converted from their
 * `GValue`s, and its result is written back into the closure's return `GValue` when it has one.
 *
 * A parameter that is itself a `GValue`, such as the target a property binding transform fills in,
 * arrives as the caller's own `GObject.Value` rather than a copy, so writing to it is how the
 * handler produces that parameter's value. It stops being valid once the handler returns.
 */
type ClosureCallback = (...args: never[]) => unknown;
type ClosureRelease = () => void;
type ClosureKind = "callback" | "signal";

const N_PARAM_VALUES_INDEX = 2;
const MARSHAL_DATA_INDEX = 5;
const CLOSURE_T = boxedT("GClosure", { sharedLibrary: LIB, getTypeFnName: "g_closure_get_type" });

const MARSHAL_VALUE_T = boxedT("GValue", {
    sharedLibrary: LIB,
    getTypeFnName: "g_value_get_type",
    size: VALUE_SIZE,
    isCallerAllocated: true,
});

const MARSHAL_T = callbackT(
    [
        CLOSURE_T,
        MARSHAL_VALUE_T,
        uint32T,
        sizedArrayT(MARSHAL_VALUE_T, N_PARAM_VALUES_INDEX, "borrowed", { elementSize: VALUE_SIZE }),
        structT("borrowed"),
        bufferT,
    ],
    voidT,
    {
        hasUserData: true,
        userDataIndex: MARSHAL_DATA_INDEX,
        hasDestroy: true,
        destroyKind: "closureNotify",
        scope: "notified",
    },
);

const NESTED_VALUE_T = structT("borrowed");
const marshalPlan = compileDescriptor(MARSHAL_T);
const gValueGetBoxed = bind(LIB, "g_value_get_boxed", [VALUE_T], NESTED_VALUE_T);
const gValueReset = bind(LIB, "g_value_reset", [VALUE_T], voidT);
const callbackPlans = new Map<string, ReturnType<typeof compileDescriptor>>();
const closureReleaseRegistry: FinalizationRegistry<ClosureRelease> = new FinalizationRegistry((release) => {
    release();
});

const isClosureInstance = (value: object): boolean =>
    typeIsA(getClassType(value.constructor as AnyClass), resolveBoxedType(CLOSURE_T));

const getNestedValue = (param: ExternalObject<Handle>): object | null =>
    wrapHandle(gValueGetBoxed(param) as ExternalObject<Handle> | null, getWrapperClass(resolveBoxedType(VALUE_T)));

const fromParamValue = (param: ExternalObject<Handle>): unknown =>
    getValueType(param) === resolveBoxedType(VALUE_T) ? getNestedValue(param) : fromValue(param);

function marshalFor(callback: ClosureCallback, kind: ClosureKind): (...args: unknown[]) => void {
    return (_closure: unknown, returnValue: unknown, _count: unknown, paramValues: unknown): void => {
        const values = paramValues as ExternalObject<Handle>[];
        const args = values.map((value) => fromParamValue(value));
        const result = (callback as (...values: unknown[]) => unknown)(...(args as never[]));

        if (returnValue === null) {
            return;
        }

        if (result === undefined && kind === "signal") {
            gValueReset(returnValue);
        } else {
            intoValue(returnValue as ExternalObject<Handle>, result);
        }
    };
}

function createClosure(callback: ClosureCallback, kind: ClosureKind, release?: ClosureRelease): ExternalObject<Handle> {
    const marshal = marshalFor(callback, kind);
    const handle = createNativeClosure(marshalPlan.abi, marshalPlan.encode(marshal), false);

    if (release !== undefined) {
        closureReleaseRegistry.register(marshal, release);
    }

    return handle;
}

function newClosure(callback: ClosureCallback, release?: ClosureRelease): ExternalObject<Handle> {
    return createClosure(callback, "callback", release);
}

function newSignalClosure(callback: ClosureCallback, release?: ClosureRelease): ExternalObject<Handle> {
    return createClosure(callback, "signal", release);
}

function newCCallbackClosure(
    key: string,
    callback: CallbackDescriptor,
    fn: unknown,
    release?: ClosureRelease,
): ExternalObject<Handle> {
    const plan = callbackPlans.getOrInsertComputed(key, () => compileDescriptor(callback));
    const handle = createNativeClosure(plan.abi, plan.encode(fn), true);

    if (release !== undefined && typeof fn === "function") {
        closureReleaseRegistry.register(fn, release);
    }

    return handle;
}

/**
 * Marshals a value passed where a `GObject.Closure` is expected into a closure handle: a function
 * becomes a new `GClosure` dispatching into it, and an existing closure yields its own handle.
 * @param value Function to wrap, or an already-built closure.
 * @throws {ClosureMarshalError} When the value is neither.
 */
function toClosure(value: unknown): ExternalObject<Handle> {
    if (typeof value === "function") {
        return newClosure(value as ClosureCallback);
    }

    if (typeof value === "object" && value !== null && isClosureInstance(value)) {
        return getHandle(value);
    }

    throw new ClosureMarshalError(`Cannot marshal ${describeValueKind(value)} into a GObject.Closure`);
}

/** Same as {@link toClosure}, but passes a null or undefined value through as no closure at all. */
function tryToClosure(value: unknown): ExternalObject<Handle> | undefined {
    return value == null ? undefined : toClosure(value);
}

/** Thrown when a value passed where a `GObject.Closure` is expected cannot be marshalled into one. */
class ClosureMarshalError extends TypeError {
    /** Name callers match on when the error is caught as a plain `TypeError`. */
    public override name = "ClosureMarshalError";
}

export { type ClosureCallback, ClosureMarshalError, newCCallbackClosure, newSignalClosure, toClosure, tryToClosure };
