import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { useLayoutEffect, useRef } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";
import { useLatestRef } from "./use-latest-ref.js";

/** The signal map `T` declares, from signal name to handler signature. */
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

const disconnectSignal = (object: GObject.Object, signal: string, emit: SignalHandler): void => {
    object.off(signal, emit);
};

const connectSignal = (
    object: GObject.Object,
    signal: string,
    emit: SignalHandler,
    options: { isAfter: boolean; isImmediate: boolean },
): void => {
    object.on(signal, emit, options.isAfter);

    if (options.isImmediate) {
        try {
            emit();
        } catch (error) {
            disconnectSignal(object, signal, emit);
            throw error;
        }
    }
};

const releaseSignal = (
    subscriptionRef: {
        current: [GObject.Object, string, SignalHandler, boolean, boolean] | null;
    },
): void => {
    const current = subscriptionRef.current;

    if (current !== null) {
        disconnectSignal(current[0], current[1], current[2]);
        subscriptionRef.current = null;
    }
};

const isCurrentSignal = (
    current: readonly [GObject.Object, string, SignalHandler, boolean, boolean] | null,
    object: GObject.Object,
    signal: string,
    options: { isAfter: boolean; isImmediate: boolean },
): boolean => current !== null &&
    current[0] === object &&
    current[1] === signal &&
    current[3] === options.isAfter &&
    current[4] === options.isImmediate;

const updateSignal = ({
    subscriptionRef,
    object,
    signal,
    handlerRef,
    options,
}: {
    subscriptionRef: { current: [GObject.Object, string, SignalHandler, boolean, boolean] | null };
    object: RefProp<GObject.Object>;
    signal: string;
    handlerRef: { readonly current: SignalHandler };
    options: { isAfter: boolean; isImmediate: boolean };
}): void => {
    const resolved = resolveRefProp(object);

    if (resolved !== null && isCurrentSignal(subscriptionRef.current, resolved, signal, options)) {
        return;
    }

    releaseSignal(subscriptionRef);

    if (resolved === null) {
        return;
    }

    const emit: SignalHandler = (...args) => handlerRef.current(...args);
    connectSignal(resolved, signal, emit, options);
    subscriptionRef.current = [resolved, signal, emit, options.isAfter, options.isImmediate];
};

const useSignalLifecycle = (
    object: RefProp<GObject.Object>,
    signal: string,
    handlerRef: { readonly current: SignalHandler },
    options: { isAfter: boolean; isImmediate: boolean },
): void => {
    const subscriptionRef = useRef<[GObject.Object, string, SignalHandler, boolean, boolean] | null>(null);

    useLayoutEffect(() => {
        updateSignal({ subscriptionRef, object, signal, handlerRef, options });
    });

    useLayoutEffect(() => {
        return () => {
            releaseSignal(subscriptionRef);
        };
    }, []);
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
function useSignal<T extends GObject.Object, S extends SignalName<T> & string>(
    object: RefProp<T>,
    signal: S,
    handler: TypedSignalHandler<T, S>,
    { isAfter = false, isImmediate = false }: UseSignalOptions = {},
): void {
    const handlerRef = useLatestRef<SignalHandler>(handler as SignalHandler);
    useSignalLifecycle(object, signal, handlerRef, { isAfter, isImmediate });
}

export { useSignal };
