/**
 * Handler invoked with errors that escape the reconciler's commit flush.
 */
export type ReconcilerErrorHandler = (error: unknown) => void;

let errorHandler: ReconcilerErrorHandler | null = null;

/**
 * Installs the reconciler error handler, returning the previously installed one.
 *
 * @param handler - The handler to install, or `null` to clear it.
 * @returns The handler that was previously installed, or `null` if none.
 */
export function setReconcilerErrorHandler(handler: ReconcilerErrorHandler | null): ReconcilerErrorHandler | null {
    const prior = errorHandler;
    errorHandler = handler;
    return prior;
}

/**
 * Reports a reconciler error to the installed handler, or logs it when none is installed.
 *
 * @param error - The error to report.
 */
export function reportReconcilerError(error: unknown): void {
    if (errorHandler) {
        errorHandler(error);
        return;
    }
    console.error("[gtkx-react] unhandled reconciler error:", error);
}
