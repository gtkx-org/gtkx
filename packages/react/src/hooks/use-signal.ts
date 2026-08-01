import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { useEffectEvent, useLayoutEffect } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";

type Signals<T extends GObject.Object> = NonNullable<T["__signals__"]>;
/** Every signal name `T` declares, on its own or narrowed by a `::detail` suffix. */
type SignalName<T extends GObject.Object> = keyof Signals<T> | `${keyof Signals<T> & string}::${string}`;

/**
 * The handler signature `T` declares for signal `S`, looked up through any `::detail` suffix and
 * falling back to an untyped `SignalHandler` when the object declares no such signal.
 */
type TypedSignalHandler<T extends GObject.Object, S extends string> = S extends keyof Signals<T>
    ? Signals<T>[S]
    : S extends `${infer TBase}::${string}`
        ? TBase extends keyof Signals<T>
            ? Signals<T>[TBase]
            : SignalHandler
        : SignalHandler;

/** Options for {@link useSignal}. */
type UseSignalOptions = {
    /** Runs the handler after the object's own default handler rather than before it. */
    isAfter?: boolean;
    /** Invokes the handler once, with no arguments, as soon as the signal is connected. */
    isImmediate?: boolean;
};

/**
 * Connects a handler to a GObject signal for the lifetime of the component, reconnecting when the object changes.
 *
 * Each emission runs the handler from the latest render, so it does not have to be stable and a
 * changing handler never reconnects the signal.
 *
 * On React 19.2 this does not hold inside a component wrapped in `memo` or `forwardRef`, where every emission
 * runs the handler captured on the first render. Keep the calling component unwrapped, or read the values the
 * handler needs off the GObject itself. React fixes this on the 19.3 line.
 *
 * @param signal The signal name, optionally with a `::detail` suffix.
 * @param options `isAfter` runs the handler after the default handler; `isImmediate` also invokes it on connect.
 */
function useSignal<T extends GObject.Object, S extends SignalName<T> & string>(
    object: RefProp<T>,
    signal: S,
    handler: TypedSignalHandler<T, S>,
    { isAfter = false, isImmediate = false }: UseSignalOptions = {},
): void {
    const emit = useEffectEvent(handler as SignalHandler);

    useLayoutEffect(() => {
        const resolved = resolveRefProp(object);

        if (!resolved) {
            return;
        }

        resolved.on(signal, emit, isAfter);

        if (isImmediate) {
            emit();
        }

        return () => {
            resolved.off(signal, emit);
        };
    }, [object, signal, isAfter, isImmediate]);
}

export { useSignal, type SignalName, type TypedSignalHandler };
