type ErrorHandler = (error: unknown) => void;
type ErrorHandlerSlot = { get: () => ErrorHandler | null; set: (handler: ErrorHandler) => ErrorHandler | null };

const errorHandlerSlot = createErrorHandlerSlot();
const commitState: { reporter: ErrorHandler | null } = { reporter: null };

function createErrorHandlerSlot(): ErrorHandlerSlot {
    let current: ErrorHandler | null = null;

    return {
        get: () => current,
        set: (handler) => {
            const previous = current;
            current = handler;

            return previous;
        },
    };
}

const setReconcilerErrorHandler = (handler: ErrorHandler): ErrorHandler | null => errorHandlerSlot.set(handler);

const reportReconcilerError = (error: unknown): void => {
    errorHandlerSlot.get()?.(error);
};

const runWithErrorReporter = (reporter: ErrorHandler | null, operation: () => void): void => {
    try {
        operation();
    } catch (error) {
        if (reporter === null) {
            throw error;
        }

        reporter(error);
    }
};

const beginCommit = (reporter: ErrorHandler): void => {
    commitState.reporter = reporter;
};

const finishCommit = (flush: () => void): void => {
    const reporter = commitState.reporter;
    commitState.reporter = null;

    try {
        flush();
    } catch (error) {
        if (reporter === null) {
            throw error;
        }

        reporter(error);
    }
};

export {
    beginCommit,
    finishCommit,
    reportReconcilerError,
    runWithErrorReporter,
    setReconcilerErrorHandler,
};
