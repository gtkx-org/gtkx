import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flushEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type SyncCallback<T> = () => T;
type AsyncCallback<T> = () => Promise<T>;

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
    value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function";

/**
 * Runs a callback inside React's `act`, dispatching synchronously when the
 * callback is synchronous and asynchronously when the callback returns a
 * `Promise`. Mirrors `@testing-library/react`'s `act-compat`.
 *
 * Synchronous callbacks commit React updates and return immediately — no
 * event-loop yield. Use this for fire-and-forget interactions where there
 * is no further async work the caller needs to wait on.
 *
 * Asynchronous callbacks are awaited, then yield one event-loop tick so
 * GTK can process any signals the React commit emitted before the caller
 * resumes. Wrap callers that mutate React state and then read GTK
 * properties affected by signals in this form.
 *
 * @example sync use
 * ```tsx
 * act(() => widget.setSensitive(false));
 * expect(widget.getSensitive()).toBe(false);
 * ```
 *
 * @example async use
 * ```tsx
 * await act(async () => {
 *     widget.activate();
 *     await screen.findByText("Done");
 * });
 * ```
 */
export function act<T>(callback: SyncCallback<T>): T;
export function act<T>(callback: AsyncCallback<T>): Promise<T>;
export function act<T>(callback: SyncCallback<T> | AsyncCallback<T>): T | Promise<T> {
    let pendingAsync: Promise<T> | null = null;
    let syncResult: T | undefined;

    const actReturn = reactAct(() => {
        const result = callback();
        if (isThenable(result)) {
            pendingAsync = result as Promise<T>;
            return result;
        }
        syncResult = result as T;
        return undefined;
    });

    if (pendingAsync !== null) {
        const captured = pendingAsync;
        return (async () => {
            await actReturn;
            const value = await captured;
            await flushEventLoop();
            return value;
        })();
    }
    return syncResult as T;
}
