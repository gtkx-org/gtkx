import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Drains the microtask queue without yielding to macrotasks. Covers
 * `queueMicrotask`-deferred reconciler work (selection-model rebuilds,
 * bound-item refreshes, etc.) without giving the GTK main loop a chance
 * to fire follow-on tick callbacks.
 */
const flushMicrotasks = (): Promise<void> => Promise.resolve();

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
 * - **Synchronous callback** — only the microtask queue is drained
 *   (`Promise.resolve()`). That is enough to settle the reconciler's
 *   `queueMicrotask`-deferred bookkeeping. Macrotask-scheduled work
 *   (`setTimeout`-driven tick callbacks, idle handlers) stays outside
 *   `act`, which is what keeps `render` and `fireEvent` fast.
 *
 * - **Asynchronous callback** — the callback is awaited and then we yield
 *   one full event-loop tick (`setTimeout(0)`). Callers who reach for the
 *   async form are already signalling that they need to wait on something
 *   external — a long-running interaction, follow-on GTK signals — and
 *   should pay the cost of one main-loop iteration.
 *
 * @example
 * ```tsx
 * // sync: microtask flush
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
            await flushMicrotasks();
        }
    });
    return result as T;
};
