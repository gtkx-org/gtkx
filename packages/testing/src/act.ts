import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const getGlobalThis = (): typeof globalThis => {
    if (typeof globalThis !== "undefined") return globalThis;
    throw new Error("unable to locate global object");
};

/**
 * Returns the current `IS_REACT_ACT_ENVIRONMENT` flag, which controls whether
 * React captures state updates as act-wrapped work.
 *
 * Async utilities such as {@link waitFor} read it to remember the caller's
 * environment before clearing the flag for the duration of a poll.
 *
 * @returns The flag's current value, or `undefined` when it has never been set.
 * @example
 * ```ts
 * const wasActive = getIsReactActEnvironment();
 * ```
 */
export const getIsReactActEnvironment = (): boolean | undefined => getGlobalThis().IS_REACT_ACT_ENVIRONMENT;

/**
 * Sets the `IS_REACT_ACT_ENVIRONMENT` flag that controls whether React captures
 * state updates as act-wrapped work.
 *
 * {@link act} and the async utilities toggle it around scopes that should — or
 * should not — capture updates; a test rendering through `@gtkx/react` directly
 * clears it so the real application lifecycle runs.
 *
 * @param value - The flag value to install, or `undefined` to clear it.
 * @example
 * ```ts
 * setIsReactActEnvironment(false);
 * ```
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
export const act: ActImplementation = withGlobalActEnvironment(reactAct as ActImplementation);
