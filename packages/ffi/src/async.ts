/**
 * Promise adapter for GIO-style asynchronous callables.
 *
 * GIO models an asynchronous operation as a pair of native callables: a
 * `foo_async(...args, GCancellable*, GAsyncReadyCallback, gpointer)` that
 * starts the operation and a companion `foo_finish(GAsyncResult*, ...)` that
 * yields its result (and throws on a `GError`). The structure of the bridge
 * between those two callables is fully invariant, so it lives here rather
 * than being inlined into every generated wrapper.
 */

import { tryGetHandle } from "./registry.js";

/**
 * The native start-callable of a GIO-style asynchronous operation. Accepts
 * the leading arguments, the resolved `GCancellable*` slot, any trailing
 * arguments, and the `GAsyncReadyCallback` invoked on completion.
 */
type AsyncStartFn = (...args: unknown[]) => void;

/**
 * The companion `*_finish` callable, already bound to its owner when the
 * async operation is an instance method. It receives the wrapped
 * `GAsyncResult` and returns the operation's result; generated callers
 * declare the concrete result type, so the runtime treats it opaquely.
 */
type AsyncFinishFn = (result: object) => unknown;

/**
 * Positional native arguments threaded through {@link promisify} into the
 * `*_async` start callable.
 */
export type PromisifyArgs = {
    /** Native arguments preceding the `GCancellable*` slot. */
    readonly leading: readonly unknown[];
    /** Native arguments between the `GCancellable*` slot and the callback (e.g. a `GFileProgressCallback`). */
    readonly trailing?: readonly unknown[];
};

/**
 * Drives a GIO-style asynchronous operation as a `Promise`.
 *
 * Starts `asyncFn` with the supplied arguments — splicing the resolved
 * `GCancellable*` handle into its dedicated slot — and an internal
 * `GAsyncReadyCallback`. The callback's `GAsyncResult` argument is already
 * lifted to its wrapper by the trampoline's handler marshalling, so on
 * completion the promise settles with `finish` applied to it directly,
 * rejecting when `finish` throws (typically a `GError`).
 *
 * @param asyncFn - The native `*_async` start callable.
 * @param finish - The companion `*_finish` callable; bound to its owner for instance methods.
 * @param cancellable - The optional `GCancellable`, or `null`/`undefined` when the operation takes none.
 * @param args - The leading and (optional) trailing native arguments to splice around the `GCancellable*` slot.
 * @returns A promise resolving with the `*_finish` result.
 */
export const promisify = (
    asyncFn: AsyncStartFn,
    finish: AsyncFinishFn,
    cancellable: object | null | undefined,
    args: PromisifyArgs,
): Promise<unknown> =>
    new Promise((resolve, reject) => {
        asyncFn(
            ...args.leading,
            tryGetHandle(cancellable),
            ...(args.trailing ?? []),
            (_source: object | null, asyncResult: object) => {
                try {
                    resolve(finish(asyncResult));
                } catch (error) {
                    reject(error);
                }
            },
        );
    });
