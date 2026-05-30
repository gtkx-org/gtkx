/**
 * Runtime signal dispatch for generated FFI bindings.
 *
 * Generated classes register a per-class signal table via
 * {@link registerSignalMeta} and delegate their `connect` and `emit` methods
 * to {@link connectSignal} and {@link emitSignal}, which centralize handler
 * wrapping, trampoline connection, and `GValue` marshalling.
 */

import type { Type } from "@gtkx/native";
import { LIBGOBJECT } from "./gtype.js";
import { getHandle, type NativeClass } from "./handles.js";
import { call, t } from "./helpers.js";

/** A user-supplied signal handler. */
export type SignalHandler = (...args: unknown[]) => unknown;

/**
 * Connect and emit metadata for a single signal, emitted by codegen.
 */
export type SignalDescriptor = {
    /** FFI trampoline descriptor passed to `g_signal_connect_data`. */
    readonly trampoline: Type;
    /**
     * Invokes the user handler with the marshalled trampoline arguments and
     * returns the value handed back to native code.
     *
     * The raw `args` carry the emitting instance first and the trampoline
     * user-data last; the closure selects and wraps the in-parameters. A
     * signal with `direction="out"` parameters omits them from the handler call
     * and instead expects the handler to return them in a `[primary, ...outs]`
     * tuple, which the native trampoline writes back through each out
     * parameter's pointer — the same convention method out-parameters use.
     */
    readonly invoke: (handler: SignalHandler, args: readonly unknown[]) => unknown;
    /** FFI type of each emit-side `GValue`, in signal-parameter order. */
    readonly emitTypes: readonly Type[];
    /** Resolves the return-value `GValue` type, or `null` for void signals. */
    readonly returnGType: (() => unknown) | null;
};

/** A `GObject.Value` instance, narrowed to the surface {@link emitSignal} uses. */
export type SignalGValue = { init(gtype: unknown): void };

/** The `GObject` namespace surface that {@link emitSignal} marshals through. */
export type SignalGObject = {
    readonly Value: new () => SignalGValue;
    /** Marshals a JS value into a `GValue` using its FFI type descriptor. */
    valueFromFfi(type: Type, value: unknown): SignalGValue;
    signalLookup(name: string, gtype: unknown): number;
    signalEmitv(values: readonly SignalGValue[], signalId: number, detail: number, returnValue?: SignalGValue): void;
};

type SignalMeta = {
    readonly signals: ReadonlyMap<string, SignalDescriptor>;
    readonly gtype: unknown;
    readonly gobject: SignalGObject;
};

const signalMetaByClass = new WeakMap<NativeClass, SignalMeta>();

/**
 * Registers the signal table for a generated class.
 *
 * Called once per signal-bearing class at module-load time.
 *
 * @param cls - The generated wrapper class
 * @param signals - Map of signal name to its connect/emit descriptor
 * @param gtype - The class's runtime `GType`, resolved at registration
 * @param gobject - The `GObject` namespace used for emit-side marshalling
 */
export function registerSignalMeta(
    cls: NativeClass,
    signals: ReadonlyMap<string, SignalDescriptor>,
    gtype: unknown,
    gobject: SignalGObject,
): void {
    signalMetaByClass.set(cls, { signals, gtype, gobject });
}

/**
 * Strips a `::detail` suffix from a signal name, yielding the bare signal the
 * per-class table is keyed by. `"notify::active"` resolves to `"notify"`; a
 * name without a detail is returned unchanged.
 */
const signalBaseName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");
    return detailIndex === -1 ? signal : signal.slice(0, detailIndex);
};

/**
 * Identifies the emitting object and the class whose signal table to consult.
 *
 * Passed as the first argument to {@link connectSignal} and {@link emitSignal}.
 */
export type SignalTarget = {
    readonly instance: object;
    readonly cls: NativeClass;
};

/**
 * Optional configuration for {@link connectSignal}.
 */
export type ConnectSignalOptions = {
    /** When true, run the handler after the default handler. */
    readonly after?: boolean | undefined;
    /** The inherited `connect`, used for non-own signals. */
    readonly parentConnect?: (signal: string, handler: SignalHandler, after?: boolean) => number;
};

/**
 * Runtime implementation of a generated class's `connect` method.
 *
 * Resolves the signal's {@link SignalDescriptor} by its bare name (so a
 * `::detail` suffix such as `notify::active` reuses the base signal's typed
 * trampoline), wraps the handler, and dispatches `g_signal_connect_data` with
 * the full detailed name. Signals absent from the class table fall through to
 * `parentConnect`; when no parent is supplied (the root `GObject.Object`),
 * an unknown signal throws.
 *
 * @param target - The emitting object and the class whose signal table to consult
 * @param signal - The signal name, optionally carrying a `::detail` suffix
 * @param handler - The user handler
 * @param options - Optional `after` flag and inherited `connect` fallback
 * @returns The handler connection id
 */
export function connectSignal(
    target: SignalTarget,
    signal: string,
    handler: SignalHandler,
    options: ConnectSignalOptions = {},
): number {
    const { instance, cls } = target;
    const { after, parentConnect } = options;
    const descriptor = signalMetaByClass.get(cls)?.signals.get(signalBaseName(signal));
    if (!descriptor) {
        if (parentConnect) return parentConnect(signal, handler, after);
        throw new Error(`Unknown signal '${signal}'`);
    }

    const wrappedHandler = (...args: unknown[]): unknown => descriptor.invoke(handler, args);
    return call(
        LIBGOBJECT,
        "g_signal_connect_data",
        [
            { type: t.object("borrowed"), value: getHandle(instance) },
            { type: t.string("borrowed"), value: signal },
            { type: descriptor.trampoline, value: wrappedHandler },
            { type: t.uint32, value: after ? 1 : 0 },
        ],
        t.uint64,
    ) as number;
}

/**
 * Runtime implementation of a generated class's `emit` method.
 *
 * Resolves the signal's {@link SignalDescriptor}, marshals `args` into
 * `GValue`s, and dispatches `g_signal_emitv`. Signals absent from the class
 * table fall through to `parentEmit`; when no parent is supplied (the root
 * `GObject.Object`) an unknown signal throws.
 *
 * @param target - The emitting object and the class whose signal table to consult
 * @param sigName - The signal name
 * @param args - The signal arguments
 * @param parentEmit - The inherited `emit`, used for non-own signals
 */
export function emitSignal(
    target: SignalTarget,
    sigName: string,
    args: readonly unknown[],
    parentEmit?: (sigName: string, ...args: unknown[]) => void,
): void {
    const { instance, cls } = target;
    const meta = signalMetaByClass.get(cls);
    const descriptor = meta?.signals.get(sigName);
    if (!meta || !descriptor) {
        if (parentEmit) {
            parentEmit(sigName, ...args);
            return;
        }
        throw new Error(`Unknown signal '${sigName}'`);
    }

    const { gobject } = meta;
    const values: SignalGValue[] = [gobject.valueFromFfi(t.object("full"), instance)];
    for (let i = 0; i < descriptor.emitTypes.length; i++) {
        const emitType = descriptor.emitTypes[i];
        if (emitType !== undefined) {
            values.push(gobject.valueFromFfi(emitType, args[i]));
        }
    }

    const signalId = gobject.signalLookup(sigName, meta.gtype);
    if (descriptor.returnGType === null) {
        gobject.signalEmitv(values, signalId, 0);
    } else {
        const returnValue = new gobject.Value();
        returnValue.init(descriptor.returnGType());
        gobject.signalEmitv(values, signalId, 0, returnValue);
    }
}
