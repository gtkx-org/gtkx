import { createLogger, type Logger } from "@gtkx/utils";

export const log: Logger = createLogger("react");

/**
 * Callback invoked with an error thrown during reconciliation.
 */
export type ReconcilerErrorHandler = (error: unknown) => void;

let errorHandler: ReconcilerErrorHandler | null = null;

/**
 * Installs a handler for errors thrown during reconciliation, replacing any existing one.
 *
 * @param handler The handler to install, or `null` to clear it.
 * @returns The previously installed handler, or `null` if none was set.
 */
export function setReconcilerErrorHandler(handler: ReconcilerErrorHandler | null): ReconcilerErrorHandler | null {
    const prior = errorHandler;
    errorHandler = handler;
    return prior;
}

export function reportReconcilerError(error: unknown): void {
    if (errorHandler) {
        errorHandler(error);
        return;
    }
    log.error("unhandled reconciler error", error);
}

export function catchReconcilerError(fn: () => void): void {
    try {
        fn();
    } catch (error) {
        reportReconcilerError(error);
    }
}
