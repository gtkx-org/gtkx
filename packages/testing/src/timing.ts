import { setApplicationTeardown, setDeferredFlushWrapper } from "@gtkx/react";
import * as React from "react";
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

/**
 * GTK-flavored mirror of `@testing-library/react`'s `act`.
 *
 * Sets `IS_REACT_ACT_ENVIRONMENT` for the duration of the call and runs the
 * callback inside React's `act` scope. Detects whether the callback returns a
 * thenable and only keeps the act environment open across awaits when it does.
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
export const act = withGlobalActEnvironment(reactAct as ActImplementation);

const hasActQueue = (value: unknown): value is { actQueue: unknown } =>
    typeof value === "object" && value !== null && "actQueue" in value;

const extractReactActQueueHolder = (): { actQueue: unknown } | null => {
    const reactExports: Record<string, unknown> = { ...React };
    const internals = reactExports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    return hasActQueue(internals) ? internals : null;
};

const reactActQueueHolder = extractReactActQueueHolder();

const isActQueueInstalled = (): boolean => reactActQueueHolder !== null && reactActQueueHolder.actQueue !== null;

setDeferredFlushWrapper((flush) => {
    if (!getIsReactActEnvironment() || isActQueueInstalled()) {
        flush();
        return;
    }
    void act(() => {
        flush();
    });
});

setApplicationTeardown(() => {});
