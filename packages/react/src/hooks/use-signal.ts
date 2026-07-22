import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { useLayoutEffect } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";

type SignalsOf<T extends GObject.Object> = NonNullable<T["__signals__"]>;

export type SignalNameOf<T extends GObject.Object> = keyof SignalsOf<T> | `${keyof SignalsOf<T> & string}::${string}`;

export type SignalHandlerFor<T extends GObject.Object, S extends string> = S extends keyof SignalsOf<T>
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
 * @param object The GObject (or ref to one) to connect to.
 * @param signal The signal name, optionally with a detail suffix.
 * @param handler The callback invoked when the signal is emitted.
 * @param options Connection options such as running after the default handler or invoking immediately.
 */
export function useSignal<T extends GObject.Object, S extends SignalNameOf<T> & string>(
    object: RefProp<T>,
    signal: S,
    handler: SignalHandlerFor<T, S>,
    { after = false, immediate = false }: UseSignalOptions = {},
): void {
    const handlerFn = handler as SignalHandler;

    useLayoutEffect(() => {
        const resolved = resolveRefProp(object);
        if (!resolved) return;

        resolved.on(signal, handlerFn, after);
        if (immediate) handlerFn();

        return () => {
            resolved.off(signal, handlerFn);
        };
    }, [object, signal, handlerFn, after, immediate]);
}
