import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
    value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";

/**
 * Runs a callback inside React's `act` and resolves once the commit it
 * triggered has settled.
 *
 * Reconciler work that needs to land before the caller resumes is drained
 * inside `resetAfterCommit` via the post-commit queue, which `reactAct`
 * already awaits — so no additional microtask or event-loop yield is
 * required after `reactAct` resolves.
 *
 * If the callback returns a thenable, its result is awaited inside the same
 * `reactAct` invocation so any React state updates scheduled during the
 * awaited work are batched into the same act.
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
export const act = async <T>(callback: () => T | Promise<T>): Promise<T> => {
    let result: T | undefined;
    const actResult = reactAct(() => {
        const returned = callback();
        if (isThenable(returned)) {
            return Promise.resolve(returned).then((value) => {
                result = value as T;
            });
        }
        result = returned as T;
        return undefined;
    });
    await actResult;
    return result as T;
};
