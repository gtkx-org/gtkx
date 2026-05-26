/**
 * Out-of-band error channel for host-config callbacks that React does not wrap
 * in its commit-phase try/catch (notably `resetAfterCommit` and the mutation
 * callbacks `appendChild`/`removeChild`/`insertBefore`).
 *
 * React routes errors from `commitMount` and `commitUpdate` through
 * `captureCommitPhaseError`, which delivers them to the handlers passed to
 * `createContainer` and ultimately rejects the render promise. The other
 * host-config entry points get no such treatment — a throw from them escapes
 * `flushMutationEffects` as an uncaught microtask error.
 *
 * This sink lets the host-config catch such throws and forward them to the
 * same handler the renderer wired into `createContainer`, so the failure mode
 * stays consistent regardless of which host-config hook surfaced the error.
 * When no handler is registered, the error is logged to `console.error` so it
 * still surfaces without crashing the process.
 */

/**
 * The shape of a function that consumes a reconciler error.
 */
export type ReconcilerErrorHandler = (error: unknown) => void;

let errorHandler: ReconcilerErrorHandler | null = null;

/**
 * Registers the function that {@link reportReconcilerError} delegates to.
 *
 * Pass `null` to unregister. The renderer should set this immediately before
 * `createContainer` so the same callback that React would deliver
 * `captureCommitPhaseError` errors to also receives sink errors.
 *
 * Returns the handler that was previously registered, allowing callers to
 * restore it on teardown.
 *
 * @public
 */
export function setReconcilerErrorHandler(handler: ReconcilerErrorHandler | null): ReconcilerErrorHandler | null {
    const prior = errorHandler;
    errorHandler = handler;
    return prior;
}

/**
 * Forwards `error` to the currently registered reconciler error handler.
 *
 * When no handler is registered the error is logged through `console.error`
 * with a clear prefix; callers that want fatal behaviour can register a
 * re-throwing handler explicitly.
 *
 * @public
 */
export function reportReconcilerError(error: unknown): void {
    if (errorHandler) {
        errorHandler(error);
        return;
    }
    console.error("[gtkx-react] unhandled reconciler error:", error);
}
