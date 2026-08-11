type FailureTracker = {
    hasFailed: () => boolean;
    fail: (cause: unknown) => void;
};

const createFailureTracker = (report: (cause: unknown) => void): FailureTracker => {
    let hasFailed = false;
    let lastCause: unknown = null;

    return {
        hasFailed: () => hasFailed,
        fail: (cause) => {
            if (hasFailed && cause === lastCause) {
                return;
            }

            hasFailed = true;
            lastCause = cause;
            report(cause);
        },
    };
};

export { createFailureTracker, type FailureTracker };
