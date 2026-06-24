export type ReconcilerErrorHandler = (error: unknown) => void;

let errorHandler: ReconcilerErrorHandler | null = null;

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
    console.error("[gtkx-react] unhandled reconciler error:", error);
}
