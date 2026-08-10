import { type ExternalObject, type Handle, read } from "@gtkx/native";
import { type AnyClass } from "@gtkx/utils";
import { bind } from "./bind.js";
import { boxedT, callbackT, sizedArrayT, structT, uint32T, uint64T, voidT } from "./descriptors.js";
import { CLOSURE_SIZE, LIB, VALUE_SIZE, VALUE_T } from "./library.js";
import { getClassType, getHandle, getWrapperClass, instanceClassName, wrapHandle } from "./registry.js";
import { resolveBoxedType, typeIsA } from "./type.js";
import { fromValue, getValueType, intoValue } from "./value.js";

/**
 * Handler backing a `GClosure`. It receives the closure's parameters already converted from their
 * `GValue`s, and its result is written back into the closure's return `GValue` when it has one.
 *
 * A parameter that is itself a `GValue`, such as the target a property binding transform fills in,
 * arrives as the caller's own `GObject.Value` rather than a copy, so writing to it is how the
 * handler produces that parameter's value. It stops being valid once the handler returns.
 */
type ClosureCallback = (...args: never[]) => unknown;

const CCLOSURE_CALLBACK_OFFSET = CLOSURE_SIZE;
const N_PARAM_VALUES_INDEX = 2;
const MARSHAL_DATA_INDEX = 5;
const CLOSURE_T = boxedT("GClosure", { sharedLibrary: LIB, getTypeFnName: "g_closure_get_type" });

const OWNED_CLOSURE_T = boxedT("GClosure", {
    ownership: "full",
    sharedLibrary: LIB,
    getTypeFnName: "g_closure_get_type",
});

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
        sizedArrayT(MARSHAL_VALUE_T, N_PARAM_VALUES_INDEX, "borrowed", VALUE_SIZE),
        uint64T,
        uint64T,
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
const gCclosureNew = bind(LIB, "g_cclosure_new", [MARSHAL_T], OWNED_CLOSURE_T);
const gValueGetBoxed = bind(LIB, "g_value_get_boxed", [VALUE_T], NESTED_VALUE_T);
const gClosureRef = bind(LIB, "g_closure_ref", [CLOSURE_T], uint64T);
const gClosureSink = bind(LIB, "g_closure_sink", [CLOSURE_T], voidT);
const gClosureSetMarshal = bind(LIB, "g_closure_set_marshal", [CLOSURE_T, uint64T], voidT);

const isClosureInstance = (value: object): boolean =>
    typeIsA(getClassType(value.constructor as AnyClass), resolveBoxedType(CLOSURE_T));

const getNestedValue = (param: ExternalObject<Handle>): object | null =>
    wrapHandle(gValueGetBoxed(param) as ExternalObject<Handle> | null, getWrapperClass(resolveBoxedType(VALUE_T)));

const fromParamValue = (param: ExternalObject<Handle>): unknown =>
    getValueType(param) === resolveBoxedType(VALUE_T) ? getNestedValue(param) : fromValue(param);

function describeValue(value: unknown): string {
    if (value === null) {
        return "null";
    }

    if (typeof value !== "object") {
        return typeof value;
    }

    return instanceClassName(value);
}

function marshalFor(callback: ClosureCallback): (...args: unknown[]) => void {
    return (_closure: unknown, returnValue: unknown, _count: unknown, paramValues: unknown): void => {
        const values = paramValues as ExternalObject<Handle>[];
        const args = values.map((value) => fromParamValue(value));
        const result = (callback as (...values: unknown[]) => unknown)(...(args as never[]));

        if (returnValue !== null) {
            intoValue(returnValue as ExternalObject<Handle>, result);
        }
    };
}

function newClosure(callback: ClosureCallback): ExternalObject<Handle> {
    const handle = gCclosureNew(marshalFor(callback)) as ExternalObject<Handle>;
    const marshal = read(handle, uint64T, CCLOSURE_CALLBACK_OFFSET);
    gClosureRef(handle);
    gClosureSink(handle);
    gClosureSetMarshal(handle, marshal);

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

    throw new ClosureMarshalError(`Cannot marshal ${describeValue(value)} into a GObject.Closure`);
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

export { type ClosureCallback, ClosureMarshalError, toClosure, tryToClosure };
