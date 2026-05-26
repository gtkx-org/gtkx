import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Returns the current `IS_REACT_ACT_ENVIRONMENT` flag.
 *
 * Async utilities such as {@link waitFor} call this to remember the caller's
 * environment before clearing the flag for the duration of the poll.
 */
export const getIsReactActEnvironment = (): boolean | undefined => globalThis.IS_REACT_ACT_ENVIRONMENT;

/**
 * Sets the `IS_REACT_ACT_ENVIRONMENT` flag.
 *
 * Used by {@link act} and the async utilities to toggle React's act tracking
 * around scopes that should — or should not — capture state updates.
 */
export const setIsReactActEnvironment = (value: boolean | undefined): void => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = value;
};

/**
 * GTK-flavored mirror of `@testing-library/react`'s `act`.
 *
 * Sets `IS_REACT_ACT_ENVIRONMENT` for the duration of the call and runs the
 * callback inside React's async `act` scope. Sync callbacks are wrapped in
 * an `async` function so React keeps the scope open across the implicit
 * microtask boundary, capturing any state updates that signal handlers
 * (e.g. GTK list factory bind/unbind) defer via `queueMicrotask`.
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
export async function act<T>(callback: () => T | Promise<T>): Promise<T> {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(true);
    try {
        return await reactAct(async () => callback());
    } finally {
        setIsReactActEnvironment(previousActEnvironment);
    }
}
