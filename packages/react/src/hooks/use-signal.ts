import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { useEffectEvent, useLayoutEffect } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";

type SignalsOf<T extends GObject.Object> = NonNullable<T["__signals__"]>;
type SignalNameOf<T extends GObject.Object> = keyof SignalsOf<T> | `${keyof SignalsOf<T> & string}::${string}`;

type SignalHandlerFor<T extends GObject.Object, S extends string> = S extends keyof SignalsOf<T>
    ? SignalsOf<T>[S]
    : S extends `${infer TBase}::${string}`
        ? TBase extends keyof SignalsOf<T>
            ? SignalsOf<T>[TBase]
            : SignalHandler
        : SignalHandler;

type UseSignalOptions = {
    after?: boolean;
    immediate?: boolean;
};

/**
 * Connects a handler to a GObject signal for the lifetime of the component, reconnecting when the object changes.
 *
 * Each emission runs the handler from the latest render, so it does not have to be stable and a
 * changing handler never reconnects the signal.
 *
 * @param object The GObject (or ref to one) to connect to.
 * @param signal The signal name, optionally with a detail suffix.
 * @param handler The callback invoked when the signal is emitted.
 * @param options Connection options such as running after the default handler or invoking immediately.
 */
function useSignal<T extends GObject.Object, S extends SignalNameOf<T> & string>(
    object: RefProp<T>,
    signal: S,
    handler: SignalHandlerFor<T, S>,
    { after = false, immediate = false }: UseSignalOptions = {},
): void {
    const emit = useEffectEvent(handler as SignalHandler);

    useLayoutEffect(() => {
        const resolved = resolveRefProp(object);

        if (!resolved) {
            return;
        }

        resolved.on(signal, emit, after);

        if (immediate) {
            emit();
        }

        return () => {
            resolved.off(signal, emit);
        };
    }, [object, signal, after, immediate]);
}

export { useSignal, type SignalNameOf, type SignalHandlerFor };
