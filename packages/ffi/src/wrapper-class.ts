/**
 * Unified module-load registration entry point for generated FFI bindings.
 *
 * Every generated wrapper type — GObject class, interface, or boxed record —
 * registers itself with a single {@link registerWrapperClass} call into the one
 * identity registry, keyed by its `GType`. Interface and concrete `GType`s share
 * that registry because their key spaces are disjoint; interface-ness is
 * determined at resolution time from the GObject type system, not recorded here.
 */

import type { ArrayType, Type as FfiType, Handle, RefType, Value } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { getDescriptorWrapperClass } from "./descriptors.js";
import { type GType, TYPE_INTERFACE, TYPE_INVALID, typeFromName, typeFundamental, typeName } from "./gtype.js";
import { resolveBoxedGtype, valueCopyInto } from "./gvalue.js";
import {
    getHandle,
    getWrapperClass,
    registerInterfaceVfuncRegistry,
    registerVfuncRegistry,
    setClassGtype,
    tryGetHandle,
    type VfuncRegistry,
    wrapHandle,
    wrapInterfaceHandle,
} from "./registry.js";

/**
 * Registers a generated wrapper type from its runtime `GType`.
 *
 * Called automatically by generated bindings, once per type at module load. The
 * class is recorded under its `GType` regardless of kind. The `vfuncs` map, when
 * present, registers the type's overridable vtable slots; for an interface
 * `GType` (one whose fundamental is `G_TYPE_INTERFACE`) it additionally registers
 * the interface vtable so user subclasses can implement it.
 *
 * @param cls - The generated wrapper class
 * @param gtype - The runtime `GType` of the wrapper type
 * @param vfuncs - Overridable vtable slot descriptors, when the type has any
 */
export function registerWrapperClass(cls: AnyClass, gtype: GType, vfuncs?: VfuncRegistry): void {
    setClassGtype(cls, gtype);
    if (vfuncs) {
        registerVfuncRegistry(cls, vfuncs);
        if (typeFundamental(gtype) === TYPE_INTERFACE) {
            registerInterfaceVfuncRegistry(gtype, vfuncs);
        }
    }
}

/**
 * The single descriptor-driven lift from a raw native value to its typed
 * JavaScript wrapper.
 *
 * {@link wrapValue} is the read-side counterpart of the call layer: given an FFI
 * type descriptor and the raw value a native call produced, it resolves the
 * wrapper class — from the descriptor's `GType`, an interface registration, or
 * the fallback class {@link getDescriptorWrapperClass} pairs with the
 * descriptor — and lifts the value into its typed form, recursing through
 * collections and hash tables, where every leaf self-resolves from its own
 * descriptor.
 */

const wrapCollection = (ffiType: ArrayType, value: unknown): unknown => {
    if (value === null) return null;
    return (value as Value[]).map((item) => wrapValue(ffiType.itemType, item));
};

type GObjectFfiType = Extract<FfiType, { type: "gobject" }>;

const interfaceGtypeByName = new Map<string, GType>();

/**
 * Resolves the `GType` of the interface a `GObject` descriptor names, memoized
 * by name. A descriptor carries a `typeName` only for an interface-typed value —
 * codegen omits it for concrete classes — so the name maps straight to its
 * interface `GType`, paid once per interface and never on the per-call hot path.
 * An as-yet-unregistered name resolves to {@link TYPE_INVALID} and is left
 * uncached so a later registration is still seen.
 */
const interfaceGtype = (typeName: string): GType => {
    const cached = interfaceGtypeByName.get(typeName);
    if (cached !== undefined) return cached;
    const gtype = typeFromName(typeName);
    if (gtype !== TYPE_INVALID) interfaceGtypeByName.set(typeName, gtype);
    return gtype;
};

/**
 * Lifts a `GObject` value. A descriptor naming an interface — the only case it
 * carries a `typeName` — resolves through {@link wrapInterfaceHandle} so the
 * wrapper carries the interface's methods even when the runtime instance is a
 * private, unregistered implementation; a concrete-class or untyped descriptor
 * self-resolves from the handle's runtime `GType`.
 */
const wrapGObjectValue = (ffiType: GObjectFfiType, value: Handle | null): object | null => {
    if (ffiType.typeName === undefined) return wrapHandle(value, undefined);
    const gtype = interfaceGtype(ffiType.typeName);
    if (gtype === TYPE_INVALID) return wrapHandle(value, undefined);
    return wrapInterfaceHandle(value, gtype);
};

/**
 * Lifts a boxed or named-fundamental value whose FFI descriptor identifies its
 * `GType`, resolving that `GType` from the descriptor and the wrapper class from
 * the registry. A `GType`-less fundamental instead carries its wrapper class
 * paired with the descriptor, which is used directly.
 */
const wrapBoxedValue = (ffiType: FfiType, value: Handle | null): object | null => {
    if (value === null) return null;
    const paired = getDescriptorWrapperClass(ffiType);
    if (paired !== undefined) return wrapHandle(value, paired);
    const gtype = resolveBoxedGtype(ffiType);
    const cls = getWrapperClass(gtype);
    if (cls === null) {
        throw new Error(`wrapValue: no registered wrapper class for boxed GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    return wrapHandle(value, cls);
};

/**
 * Lifts a raw FFI value into its typed JavaScript form.
 *
 * A plain struct and a `GType`-less fundamental carry no `GType` to recover a
 * class from, so the binding pairs their wrapper class with the descriptor via
 * {@link getDescriptorWrapperClass}; every other kind self-resolves from its
 * descriptor's `GType` or is a primitive passed straight through. Collections
 * and hash tables recurse, each element lifting from its own descriptor.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The raw value the native call produced.
 * @returns The wrapped JavaScript value.
 */
export function wrapValue(ffiType: FfiType, value: Value): unknown {
    switch (ffiType.type) {
        case "gobject":
            return wrapGObjectValue(ffiType, value as Handle | null);
        case "struct":
            return wrapHandle(value as Handle | null, getDescriptorWrapperClass(ffiType));
        case "boxed":
        case "fundamental":
            return wrapBoxedValue(ffiType, value as Handle | null);
        case "array":
            return wrapCollection(ffiType, value);
        case "hashtable": {
            if (value === null) return null;
            const entries = value as (readonly [Value, Value])[];
            return new Map(
                entries.map(([key, val]): [unknown, unknown] => [
                    wrapValue(ffiType.keyType, key),
                    wrapValue(ffiType.valueType, val),
                ]),
            );
        }
        default:
            return value;
    }
}

const unwrapCollection = (ffiType: ArrayType, value: unknown): Value => {
    if (value == null) return null;
    return (value as unknown[]).map((item) => unwrapValue(ffiType.itemType, item));
};

/**
 * Lowers a typed JavaScript value back into the raw native value its FFI
 * descriptor expects — the write-side inverse of {@link wrapValue}.
 *
 * A wrapper of a `GObject`, boxed, struct, or fundamental value resolves to its
 * backing native handle through {@link tryGetHandle}; collections and hash
 * tables recurse, each element lowering from its own descriptor; every
 * primitive passes straight through. A nullish handle-typed value lowers to
 * `null`.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The JavaScript value to lower.
 * @returns The raw native value to hand back across the FFI boundary.
 */
export function unwrapValue(ffiType: FfiType, value: unknown): Value {
    switch (ffiType.type) {
        case "gobject":
        case "struct":
        case "boxed":
        case "fundamental":
            return tryGetHandle(value as object | null | undefined) ?? null;
        case "array":
            return unwrapCollection(ffiType, value);
        case "hashtable": {
            if (value == null) return null;
            return [...(value as Map<unknown, unknown>)].map(([key, val]): [Value, Value] => [
                unwrapValue(ffiType.keyType, key),
                unwrapValue(ffiType.valueType, val),
            ]);
        }
        default:
            return value as Value;
    }
}

/** A scalar out/inout parameter the native trampoline marshals through a `{ value }` cell. */
const isOutCell = (argType: FfiType): argType is RefType => argType.type === "ref";

/** A caller-allocated out parameter: a borrowed boxed/struct buffer filled in place. */
const isCallerAllocatedBuffer = (argType: FfiType): boolean =>
    (argType.type === "boxed" || argType.type === "struct") && argType.callerAllocated === true;

/**
 * Copies every accessor-backed field from `source` into `target` through the
 * wrapper's own setters, which deep-copy owned fields (a string duplicates, a
 * boxed copies, an object refs). Fills a caller-allocated out parameter's buffer
 * in place from the value a handler returns.
 */
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

/**
 * Fills a caller-allocated out parameter's buffer in place from a handler's
 * returned value. A `GValue` is deep-copied through {@link valueCopyInto}
 * (`g_value_copy`), the only ownership-correct fill for its `GType`-tagged
 * union payload; every other boxed or struct copies field-by-field through its
 * deep-copying setters.
 */
const fillCallerAllocatedBuffer = (argType: FfiType, target: object, source: object): void => {
    if (argType.type === "boxed" && argType.innerType === "GValue") {
        valueCopyInto(getHandle(target), getHandle(source));
        return;
    }
    copyBoxedFields(target, source);
};

/**
 * Splits a handler's result into the primary return and the out-parameter
 * values, following the tuple convention the generated public method uses: a
 * lone primary when there are no out parameters, the single out value bare for a
 * void return with one out, otherwise `[primary?, ...outs]`.
 */
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

/**
 * How a handler's leading native argument is treated by {@link wrapHandler}:
 * `"this"` binds it as the receiver (vfuncs), `"skip"` drops it (a signal's
 * emitter), `"none"` forwards it positionally (plain callbacks).
 */
export type HandlerReceiver = "this" | "skip" | "none";

/** The wrapped native→JS handler the trampoline invokes with raw FFI argument values. */
export type Handler = (...args: Value[]) => Value;

/** A user-supplied handler — a vfunc override, signal handler, or callback — of any shape. */
export type UserHandler = (...args: never[]) => unknown;

/**
 * The callback descriptor {@link wrapHandler} marshals against. {@link CallbackType}
 * satisfies it directly; a vfunc supplies the argument and return types alone.
 */
export type HandlerSpec = {
    readonly argTypes: readonly FfiType[];
    readonly returnType: FfiType;
    readonly userDataIndex?: number;
};

/** One out parameter resolved from a handler's arguments, plus its lifted wrapper. */
type OutParam = { readonly value: unknown; readonly argType: FfiType };

/**
 * Splits a handler's lifted arguments into the inputs it receives and the out
 * parameters written back. A scalar `inout` cell is both — its incoming value
 * is an input and its slot an output. A caller-allocated buffer is an output for
 * a vfunc (filled from the return) but an input for a signal/callback (mutated
 * in place). Everything else is a plain input.
 */
const partitionHandlerArgs = (
    effectiveTypes: readonly FfiType[],
    wrapped: readonly unknown[],
    start: number,
    receiver: HandlerReceiver,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const outParams: OutParam[] = [];
    for (let i = start; i < effectiveTypes.length; i++) {
        const argType = effectiveTypes[i];
        if (argType !== undefined && isOutCell(argType)) {
            if (argType.inout === true) inputs.push((wrapped[i] as { value: unknown }).value);
            outParams.push({ value: wrapped[i], argType });
        } else if (argType !== undefined && isCallerAllocatedBuffer(argType) && receiver === "this") {
            outParams.push({ value: wrapped[i], argType });
        } else {
            inputs.push(wrapped[i]);
        }
    }
    return { inputs, outParams };
};

/** Writes each out value back into its cell or caller-allocated buffer. */
const writeOutParams = (outParams: readonly OutParam[], outValues: readonly unknown[]): void => {
    outParams.forEach((outParam, position) => {
        const outValue = outValues[position];
        if (isOutCell(outParam.argType)) {
            (outParam.value as { value: unknown }).value = outValue;
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(outParam.argType, outParam.value as object, outValue as object);
        }
    });
};

/**
 * Wraps a native→JS handler (a vfunc override, signal handler, or callback) in
 * the shared marshalling the trampoline boundary needs.
 *
 * Each native argument is lifted to its typed JavaScript wrapper through
 * {@link wrapValue}, partitioned into inputs and out parameters by
 * {@link partitionHandlerArgs}, and the handler is invoked with the inputs. Out
 * values surface the way the public method does — a lone value or a
 * `[primary, ...outs]` tuple — and are written back through {@link writeOutParams};
 * the primary return is lowered through {@link unwrapValue}.
 *
 * @param fn - The user handler.
 * @param spec - The callback descriptor (argument types, return type, user-data index).
 * @param receiver - How the leading argument is treated.
 */
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
