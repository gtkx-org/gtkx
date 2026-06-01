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

import type { NativeHandle } from "@gtkx/native";
import { setHandle, tryGetHandle } from "./handles.js";

/**
 * Wraps the raw `GAsyncResult*` handle delivered to a `GAsyncReadyCallback`
 * into the minimal object a generated `*_finish` member consumes.
 *
 * A `*_finish` member only ever reads the native pointer of its result
 * argument via the internal handle accessor, so the wrapper carries nothing
 * beyond that handle. Resolving the result to a fully typed `Gio.AsyncResult`
 * wrapper would pull a generated namespace into this hand-written runtime
 * module and serve no purpose, since the result object is transient and never
 * surfaces to callers.
 */
const wrapAsyncResult = (rawResult: NativeHandle): object => {
    const result: object = {};
    setHandle(result, rawResult);
    return result;
};

/**
 * The native start-callable of a GIO-style asynchronous operation. Accepts
 * the leading arguments, the resolved `GCancellable*` slot, any trailing
 * arguments, and the `GAsyncReadyCallback` invoked on completion.
 */
type AsyncStartFn = (...args: unknown[]) => void;

/**
 * The companion `*_finish` callable, already bound to its owner when the
 * async operation is an instance method.
 *
 * `TResult` is the concrete `GAsyncResult` wrapper the `*_finish` member
 * declares (e.g. `Gio.AsyncResult`); inferring it from the supplied callable
 * lets a typed `*_finish` flow through {@link promisify} without widening its
 * parameter.
 */
type AsyncFinishFn<R, TResult> = (result: TResult) => R;

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
 * `GAsyncReadyCallback`. On completion the callback settles the promise with
 * `finish` applied to the wrapped `GAsyncResult`, rejecting when `finish`
 * throws (typically a `GError`).
 *
 * @typeParam R - The resolved value type, i.e. the `*_finish` return type.
 * @typeParam TResult - The `GAsyncResult` wrapper type the `*_finish` member accepts.
 * @param asyncFn - The native `*_async` start callable.
 * @param finish - The companion `*_finish` callable; bound to its owner for instance methods.
 * @param cancellable - The optional `GCancellable`, or `null`/`undefined` when the operation takes none.
 * @param args - The leading and (optional) trailing native arguments to splice around the `GCancellable*` slot.
 * @returns A promise resolving with the `*_finish` result.
 */
export const promisify = <R, TResult>(
    asyncFn: AsyncStartFn,
    finish: AsyncFinishFn<R, TResult>,
    cancellable: object | null | undefined,
    args: PromisifyArgs,
): Promise<R> =>
    new Promise<R>((resolve, reject) => {
        asyncFn(
            ...args.leading,
            tryGetHandle(cancellable),
            ...(args.trailing ?? []),
            (_source: NativeHandle, rawResult: NativeHandle) => {
                try {
                    resolve(finish(wrapAsyncResult(rawResult) as TResult));
                } catch (error) {
                    reject(error);
                }
            },
        );
    });
