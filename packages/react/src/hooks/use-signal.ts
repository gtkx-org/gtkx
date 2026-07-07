import type { SignalHandler } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { useRef } from "react";
import type { GObjectTarget } from "../utils/gobject-target.js";
import { useTargetRegistration } from "./use-target-registration.js";

type AnySignalHandler = { handler(...args: unknown[]): unknown }["handler"];

type AnySignalHandlers = Record<string, AnySignalHandler>;

type SignalHandlersOf<T extends GObject.Object> = T extends { __signals__?: infer H }
    ? unknown extends H
        ? AnySignalHandlers
        : NonNullable<H>
    : AnySignalHandlers;

export type SignalNameOf<T extends GObject.Object> =
    | (keyof SignalHandlersOf<T> & string)
    | `${keyof SignalHandlersOf<T> & string}::${string}`;

export type SignalHandlerFor<T extends GObject.Object, S extends string> = S extends keyof SignalHandlersOf<T>
    ? SignalHandlersOf<T>[S]
    : S extends `${infer TBase}::${string}`
      ? TBase extends keyof SignalHandlersOf<T>
          ? SignalHandlersOf<T>[TBase]
          : AnySignalHandler
      : AnySignalHandler;

type UseSignalOptions = {
    after?: boolean;
    immediate?: boolean;
};

type SignalSubscription = {
    obj: GObject.Object;
    signal: string;
    after: boolean;
    listener: SignalHandler;
};

export function useSignal<T extends GObject.Object, S extends SignalNameOf<T>>(
    target: GObjectTarget<T>,
    signal: S,
    handler: SignalHandlerFor<T, S>,
    options?: UseSignalOptions,
): void;
export function useSignal(
    target: GObjectTarget<GObject.Object>,
    signal: string,
    handler: AnySignalHandler,
    options?: UseSignalOptions,
): void {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    const after = options?.after ?? false;
    const immediate = options?.immediate ?? false;

    useTargetRegistration<GObject.Object, SignalSubscription>(target, {
        attach: (obj) => {
            const listener: SignalHandler = (...args) => handlerRef.current(...args);
            obj.on(signal, listener, after);
            if (immediate) handlerRef.current();
            return { obj, signal, after, listener };
        },
        detach: (subscription) => subscription.obj.off(subscription.signal, subscription.listener),
        isSame: (subscription, obj) =>
            subscription.obj === obj && subscription.signal === signal && subscription.after === after,
    });
}
