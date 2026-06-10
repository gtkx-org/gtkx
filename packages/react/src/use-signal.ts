import type { SignalHandler } from "@gtkx/ffi";
import * as GObject from "@gtkx/gi/gobject";
import { type RefObject, useLayoutEffect, useRef } from "react";

type AnySignalHandler = { handler(...args: unknown[]): unknown }["handler"];

type AnySignalHandlers = Record<string, AnySignalHandler>;

/**
 * The per-signal handler map associated with a GObject type, resolved through
 * the phantom `__signals__` member the codegen pipeline emits on every
 * generated class. Falls back to an open map (any name, any handler) when the
 * type carries no association.
 */
export type SignalHandlersOf<T extends GObject.Object> = T extends { readonly __signals__?: infer H }
    ? unknown extends H
        ? AnySignalHandlers
        : NonNullable<H>
    : AnySignalHandlers;

/**
 * The signal names connectable on a GObject type: every name in its handler
 * map, plus detailed forms such as `notify::some-prop` or `changed::some-key`
 * built from any base name the map declares.
 */
export type SignalNameOf<T extends GObject.Object> =
    | (keyof SignalHandlersOf<T> & string)
    | `${keyof SignalHandlersOf<T> & string}::${string}`;

/**
 * The handler type for signal `S` on a GObject type: the exact mapped handler
 * for a known name, the base signal's handler for a detailed name
 * (`notify::title` resolves to the `notify` handler), and an open handler
 * otherwise.
 */
export type SignalHandlerFor<T extends GObject.Object, S extends string> = S extends keyof SignalHandlersOf<T>
    ? SignalHandlersOf<T>[S]
    : S extends `${infer TBase}::${string}`
      ? TBase extends keyof SignalHandlersOf<T>
          ? SignalHandlersOf<T>[TBase]
          : AnySignalHandler
      : AnySignalHandler;

/**
 * A signal source accepted by {@link useSignal}: the object itself, a React
 * ref holding it (such as a `ref` to a JSX widget), or `null`/`undefined` to
 * keep the hook inactive.
 */
export type SignalTarget<T extends GObject.Object> = T | RefObject<T | null> | null | undefined;

/**
 * Options controlling how {@link useSignal} subscribes its handler.
 */
export interface UseSignalOptions {
    /**
     * Runs the handler after the signal's default class closure, matching the
     * `after` parameter of `on`.
     */
    after?: boolean;
    /**
     * Invokes the handler once, with no arguments, immediately after each
     * successful (re)subscription. Intended for handlers that re-read state
     * from the object and ignore emission arguments.
     */
    immediate?: boolean;
}

interface SignalSubscription {
    readonly obj: GObject.Object;
    readonly signal: string;
    readonly after: boolean;
    readonly listener: SignalHandler;
}

type ResolvableTarget = GObject.Object | { readonly current: GObject.Object | null } | null | undefined;

const resolveTarget = (target: ResolvableTarget): GObject.Object | null => {
    if (!target) return null;
    if (target instanceof GObject.Object) return target;
    return target.current;
};

const dropSubscription = (subscriptionRef: RefObject<SignalSubscription | null>): void => {
    const subscription = subscriptionRef.current;
    if (subscription) {
        subscription.obj.off(subscription.signal, subscription.listener);
        subscriptionRef.current = null;
    }
};

/**
 * Subscribes a callback to a GObject signal via `on` and unsubscribes it
 * automatically on unmount or when the target, signal name, or `after` option
 * changes.
 *
 * The latest callback is read on each emission, so changing the handler never
 * resubscribes the signal. The target may be a React ref to a JSX widget; the
 * subscription follows the ref, reattaching when a later commit replaces the
 * widget. When the target is or resolves to `null`/`undefined`, the hook is
 * inactive.
 *
 * The handler receives the arguments `on` delivers, without the trailing
 * emitting-object argument that JSX `onX` props append. The subscription
 * bypasses the reconciler's commit-time signal suppression, so it also fires
 * for changes React itself applies; prefer JSX `onX` props for signals on
 * widgets the tree owns. `useSignal` is for objects outside the tree — list
 * models, selection models, providers — and for detailed signal names no
 * generated prop covers.
 *
 * @param target - The GObject to observe, a ref holding it, or null/undefined to disable
 * @param signal - The signal name, including detailed forms such as `notify::title`
 * @param handler - The callback invoked on each emission
 * @param options - Subscription options, see {@link UseSignalOptions}
 *
 * @example
 * ```tsx
 * const selection = useMemo(() => new Gtk.MultiSelection({ model: store }), [store]);
 * useSignal(selection, "selection-changed", () => {
 *     setSelectedItems(collectSelectedItems(selection));
 * }, { immediate: true });
 * ```
 *
 * @example
 * ```tsx
 * const windowRef = useRef<Gtk.Window | null>(null);
 * useSignal(windowRef, "notify::fullscreened", () => {
 *     setFullscreened(windowRef.current?.isFullscreen() ?? false);
 * });
 * ```
 */
export function useSignal<T extends GObject.Object, S extends SignalNameOf<T>>(
    target: SignalTarget<T>,
    signal: S,
    handler: SignalHandlerFor<T, S>,
    options?: UseSignalOptions,
): void;
export function useSignal(
    target: ResolvableTarget,
    signal: string,
    handler: AnySignalHandler,
    options?: UseSignalOptions,
): void {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    const subscriptionRef = useRef<SignalSubscription | null>(null);
    const after = options?.after ?? false;
    const immediate = options?.immediate ?? false;

    useLayoutEffect(() => {
        const obj = resolveTarget(target);
        const subscription = subscriptionRef.current;
        if (
            subscription &&
            subscription.obj === obj &&
            subscription.signal === signal &&
            subscription.after === after
        ) {
            return;
        }
        dropSubscription(subscriptionRef);
        if (!obj) return;
        const listener: SignalHandler = (...args) => handlerRef.current(...args);
        obj.on(signal, listener, after);
        subscriptionRef.current = { obj, signal, after, listener };
        if (immediate) handlerRef.current();
    });

    useLayoutEffect(() => () => dropSubscription(subscriptionRef), []);
}
