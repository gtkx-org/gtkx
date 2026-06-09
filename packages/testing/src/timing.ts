import * as GLib from "@gtkx/gi/glib";
import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const getGlobalThis = (): typeof globalThis => {
    if (typeof globalThis !== "undefined") return globalThis;
    throw new Error("unable to locate global object");
};

/**
 * Returns the current `IS_REACT_ACT_ENVIRONMENT` flag.
 *
 * Async utilities such as {@link waitFor} call this to remember the caller's
 * environment before clearing the flag for the duration of the poll.
 */
export const getIsReactActEnvironment = (): boolean | undefined => getGlobalThis().IS_REACT_ACT_ENVIRONMENT;

/**
 * Sets the `IS_REACT_ACT_ENVIRONMENT` flag.
 *
 * Used by {@link act} and the async utilities to toggle React's act tracking
 * around scopes that should — or should not — capture state updates.
 */
export const setIsReactActEnvironment = (value: boolean | undefined): void => {
    getGlobalThis().IS_REACT_ACT_ENVIRONMENT = value;
};

setIsReactActEnvironment(true);

type ActCallback<T> = () => T | PromiseLike<T>;
type ActImplementation = <T>(callback: ActCallback<T>) => PromiseLike<T>;

const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
    value !== null && typeof value === "object" && typeof (value as PromiseLike<T>).then === "function";

const withGlobalActEnvironment =
    (actImplementation: ActImplementation) =>
    <T>(callback: ActCallback<T>): PromiseLike<T> => {
        const previousActEnvironment = getIsReactActEnvironment();
        setIsReactActEnvironment(true);
        try {
            let callbackNeedsToBeAwaited = false;
            const actResult = actImplementation(() => {
                const result = callback();
                if (isThenable<T>(result)) {
                    callbackNeedsToBeAwaited = true;
                }
                return result;
            });
            if (callbackNeedsToBeAwaited) {
                return Promise.resolve(actResult).then(
                    (value) => {
                        setIsReactActEnvironment(previousActEnvironment);
                        return value;
                    },
                    (error) => {
                        setIsReactActEnvironment(previousActEnvironment);
                        throw error;
                    },
                );
            }
            setIsReactActEnvironment(previousActEnvironment);
            return actResult;
        } catch (error) {
            setIsReactActEnvironment(previousActEnvironment);
            throw error;
        }
    };

const rawAct = withGlobalActEnvironment(reactAct as ActImplementation);

const idleRoundTrip = (): Promise<void> =>
    new Promise((resolve) => {
        GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => {
            resolve();
            return false;
        });
    });

const macrotask = (): Promise<void> =>
    new Promise((resolve) => {
        setImmediate(resolve);
    });

const SETTLE_ROUNDS = 2;

/**
 * Awaits a few GLib main-loop round-trips, draining the JS task queue after
 * each, so deferred framework work settles before the caller proceeds.
 *
 * Each round schedules a `GLib.PRIORITY_DEFAULT_IDLE` source — which fires
 * only after pending layout and redraw — and then yields a macrotask turn so
 * callbacks the round delivered (list and column cell binds, portal
 * refreshes) run to completion. {@link act} already settles before returning;
 * reach for this directly only after GTK calls made outside any helper.
 */
export const settle = async (): Promise<void> => {
    for (let round = 0; round < SETTLE_ROUNDS; round++) {
        await idleRoundTrip();
        await macrotask();
    }
};

const settleAfter = async <T>(result: T | PromiseLike<T>): Promise<T> => {
    const value = await result;
    await settle();
    return value;
};

/**
 * GTK-flavored mirror of `@testing-library/react`'s `act`.
 *
 * Sets `IS_REACT_ACT_ENVIRONMENT` for the duration of the call, runs the
 * callback inside React's `act` scope, and {@link settle}s within that scope
 * before returning, so GTK-driven follow-up work — virtualized cells binding,
 * portals re-rendering — lands inside the call instead of escaping the test's
 * act tracking. A synchronous throw from the callback propagates
 * synchronously. Every async helper in this package routes its mutations
 * through this wrapper.
 *
 * @example
 * ```tsx
 * await act(() => widget.setSensitive(false));
 *
 * await act(async () => {
 *     widget.activate();
 *     await screen.findByText("Done");
 * });
 * ```
 */
export const act = <T>(callback: ActCallback<T>): PromiseLike<T> => rawAct(() => settleAfter(callback()));
