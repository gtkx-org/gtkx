import type * as GObject from "@gtkx/gi/gobject";
import type { SignalMap, SignalName } from "@gtkx/runtime/internal";
import { offSignal, onSignal, type SignalHandler } from "@gtkx/runtime";
import { useLayoutEffect } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useLatestRef } from "./use-latest-ref.js";

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
 * Each emission runs the handler from the latest committed render, so it does not have to be stable and a
 * changing handler never reconnects the signal.
 *
 * @param signal The signal name, optionally with a `::detail` suffix.
 * @param options `isAfter` runs the handler after the default handler; `isImmediate` also invokes it on connect.
 */
function useSignal<T extends Pick<GObject.Object, "__signals__" | "__type__">, S extends SignalName<T>>(
    object: RefProp<T>,
    signal: S,
    handler: SignalMap<T>[S],
    { isAfter = false, isImmediate = false }: UseSignalOptions = {},
): void {
    const handlerRef = useLatestRef<SignalHandler>(handler as SignalHandler);

    useLayoutEffect(() => {
        const resolved = resolveRefProp(object);

        if (!resolved) {
            return;
        }

        const emit: SignalHandler = (...args) => handlerRef.current(...args);
        onSignal(resolved, signal, emit, isAfter);

        if (isImmediate) {
            emit();
        }

        return () => {
            offSignal(resolved, signal, emit);
        };
    }, [handlerRef, object, signal, isAfter, isImmediate]);
}

export { useSignal };
