/**
 * The signal-emission counterpart of {@link ffiCall}: it marshals a
 * `g_signal_emitv` dispatch and reads back its result entirely behind one entry
 * point, so a generated `emit` switch carries no GValue vocabulary — only the
 * per-signal argument descriptors and the bare `g_signal_emitv` call.
 *
 * The runtime binds `g_signal_emitv` and `g_signal_lookup` directly rather than
 * routing through the generated `GObject` namespace, keeping the hand-written
 * layer free of any dependency on generated code. The `instance_and_params`
 * array is laid out as inline 24-byte `GValue` cells; the descriptor matches the
 * one the generated binding emits byte-for-byte.
 */

import type { Type as FfiType } from "@gtkx/native";
import {
    emptyValueFromFfi,
    getGvalueBoxed,
    inoutBoxedFromFfi,
    outBoxedFromFfi,
    valueFromFfi,
} from "./gobject/gvalue.js";
import type { GValue } from "./gobject/gvalue-native.js";
import { type GType, GVALUE_BORROWED, LIBGOBJECT } from "./gtype.js";
import { type GTyped, getHandle } from "./handles.js";
import { t } from "./helpers.js";
import { signalBaseName, signalDetailQuark } from "./signals.js";
import { outValueFromFfi, valueToJS } from "./value-marshal.js";

const GVALUE_INLINE: FfiType = t.boxed("GValue", "borrowed", LIBGOBJECT, "g_value_get_type");

const g_signal_emitv = t.fn(
    LIBGOBJECT,
    "g_signal_emitv",
    [
        { type: t.array(GVALUE_INLINE, "array", "borrowed", { elementSize: 24 }) },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: GVALUE_BORROWED },
    ],
    t.void,
);

const g_signal_lookup = t.fn(
    LIBGOBJECT,
    "g_signal_lookup",
    [{ type: t.string("borrowed") }, { type: t.uint64 }],
    t.uint32,
);

/**
 * How a signal parameter is marshalled into its emission `GValue` beyond a
 * plain input:
 *
 * - `"out"` — a pointer-backed cell the handler writes through; read back after.
 * - `"inout"` — a scalar cell seeded from `value`, read back after.
 * - `"boxedOut"` — a caller-allocated boxed record (`value`) copied into a
 *   `G_TYPE_BOXED` cell the handler fills; the owned copy is read back.
 * - `"boxedInout"` — a boxed record (`value`) shared in place, so the handler's
 *   mutation lands on the caller's wrapper and surfaces through it, not the result.
 */
type EmitArgRole = "out" | "inout" | "boxedOut" | "boxedInout";

/** One argument of a signal emission. A plain input omits `role`. */
export type EmitArg = {
    /** The argument's FFI type descriptor. */
    readonly ffi: FfiType;
    /** How the argument is marshalled beyond a plain input. */
    readonly role?: EmitArgRole;
    /**
     * The input value for an in/inout argument, or the caller-allocated wrapper
     * for a boxed out/inout argument. Omitted for a pure `"out"`.
     */
    readonly value?: unknown;
};

const assembleResult = (primary: unknown, hasPrimary: boolean, reads: readonly (() => unknown)[]): unknown => {
    const outs = reads.map((read) => read());
    if (hasPrimary) {
        return outs.length === 0 ? primary : [primary, ...outs];
    }
    if (outs.length === 0) return undefined;
    if (outs.length === 1) return outs[0];
    return outs;
};

/**
 * Emits a GObject signal and returns its result.
 *
 * Resolves the signal id from the instance's runtime GType and the detail quark
 * from any `::detail` suffix on `sigName`, marshals the emitter and each
 * argument into the `GValue` array `g_signal_emitv` consumes, dispatches, then
 * assembles the result following the tuple convention: a lone return value, a
 * single out-value, or `[primary, ...outs]` when both are present.
 *
 * @param instance - The emitting object.
 * @param sigName - The signal name, optionally carrying a `::detail` suffix.
 * @param args - The signal's argument descriptors, in declaration order.
 * @param returnFfi - The return value's FFI type, or `undefined` for a void signal.
 * @returns The signal's result.
 */
export function emitGobjectSignal(
    instance: object,
    sigName: string,
    args: readonly EmitArg[],
    returnFfi?: FfiType,
): unknown {
    const gtype: GType = (instance as GTyped).__gtype__;
    const signalId = g_signal_lookup(signalBaseName(sigName), gtype) as number;
    const detail = signalDetailQuark(sigName);

    const values: GValue[] = [valueFromFfi(t.object("full"), instance)];
    const reads: (() => unknown)[] = [];
    for (const arg of args) {
        switch (arg.role) {
            case "out": {
                const cell = outValueFromFfi(arg.ffi);
                values.push(cell.value);
                reads.push(cell.read);
                break;
            }
            case "inout": {
                const cell = outValueFromFfi(arg.ffi, arg.value);
                values.push(cell.value);
                reads.push(cell.read);
                break;
            }
            case "boxedOut": {
                const value = outBoxedFromFfi(arg.ffi, arg.value as object);
                values.push(value);
                reads.push(() => getGvalueBoxed(value));
                break;
            }
            case "boxedInout":
                values.push(inoutBoxedFromFfi(arg.ffi, arg.value as object));
                break;
            default:
                values.push(valueFromFfi(arg.ffi, arg.value));
        }
    }

    const handles = values.map(getHandle);
    if (returnFfi !== undefined) {
        const returnValue = emptyValueFromFfi(returnFfi);
        g_signal_emitv(handles, signalId, detail, getHandle(returnValue));
        return assembleResult(valueToJS(returnValue), true, reads);
    }
    g_signal_emitv(handles, signalId, detail, undefined);
    return assembleResult(undefined, false, reads);
}
