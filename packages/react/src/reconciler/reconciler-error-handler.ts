import { log } from "./log.js";

export type ReconcilerErrorHandler = (error: unknown) => void;

let errorHandler: ReconcilerErrorHandler | null = null;

export function setReconcilerErrorHandler(handler: ReconcilerErrorHandler | null): ReconcilerErrorHandler | null {
    const prior = errorHandler;
    errorHandler = handler;
    return prior;
}

function reportReconcilerError(error: unknown): void {
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
