import type * as GObject from "@gtkx/gi/gobject";
import { offSignal, onSignal, type SignalHandler } from "@gtkx/runtime";
import { useLayoutEffect } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useLatestRef } from "./use-latest-ref.js";

/** The signal map `T` declares, from signal name to handler signature. */
type Signals<T extends Pick<GObject.Object, "__signals__" | "__type__">> = NonNullable<T["__signals__"]>;
/** Every signal name `T` declares, on its own or narrowed by a `::detail` suffix. */
type SignalName<T extends Pick<GObject.Object, "__signals__" | "__type__">> =
    keyof Signals<T> | `${keyof Signals<T> & string}::${string}`;

/**
 * The handler signature `T` declares for signal `S`, looked up through any `::detail` suffix and
 * falling back to an untyped `SignalHandler` when the object declares no such signal.
 */
type TypedSignalHandler<
    T extends Pick<GObject.Object, "__signals__" | "__type__">,
    S extends string,
> = S extends keyof Signals<T>
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
 * Each emission runs the handler from the latest committed render, so it does not have to be stable and a
 * changing handler never reconnects the signal.
 *
 * @param signal The signal name, optionally with a `::detail` suffix.
 * @param options `isAfter` runs the handler after the default handler; `isImmediate` also invokes it on connect.
 */
function useSignal<T extends Pick<GObject.Object, "__signals__" | "__type__">, S extends SignalName<T> & string>(
    object: RefProp<T>,
    signal: S,
    handler: TypedSignalHandler<T, S>,
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
