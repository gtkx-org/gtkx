import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Yields one full event-loop tick so the GTK main loop can iterate and
 * propagate any signals the React commit emitted before the caller
 * resumes.
 */
const flushEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
    value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";

/**
 * Runs a callback inside React's `act`, then flushes deferred work so the
 * test sees a settled tree.
 *
 * The depth of the flush is chosen from the callback's shape:
 *
 * - **Synchronous callback** — no post-`act` flush. Reconciler work that
 *   needs to land before the caller resumes is drained inside
 *   `resetAfterCommit` via the post-commit queue, which `reactAct` already
 *   awaits, so the tree is settled by the time `act` resolves.
 *
 * - **Asynchronous callback** — the callback is awaited and then we yield
 *   one full event-loop tick (`setTimeout(0)`). Callers who reach for the
 *   async form are already signalling that they need to wait on something
 *   external — a long-running interaction, follow-on GTK signals — and
 *   should pay the cost of one main-loop iteration.
 *
 * @example
 * ```tsx
 * // sync: no extra flush, reconciler work drains inside the commit
 * await act(() => widget.setSensitive(false));
 *
 * // async: setTimeout flush
 * await act(async () => {
 *     widget.activate();
 *     await screen.findByText("Done");
 * });
 * ```
 */
export const act = async <T>(callback: () => T | Promise<T>): Promise<T> => {
    let result: T | undefined;
    await reactAct(async () => {
        const returned = callback();
        if (isThenable(returned)) {
            result = (await returned) as T;
            await flushEventLoop();
        } else {
            result = returned as T;
        }
    });
    return result as T;
};
