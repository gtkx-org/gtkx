type CleanupFunction = () => void | Promise<void>;

const cleanupQueue: Set<CleanupFunction> = new Set();

const addToCleanupQueue = (fn: CleanupFunction): void => {
    cleanupQueue.add(fn);
};

const runCleanupCallbacks = async (callbacks: Iterable<CleanupFunction>): Promise<void> => {
    const failures: unknown[] = [];

    for (const fn of callbacks) {
        try {
            await fn();
        } catch (error) {
            failures.push(error);
        }
    }

    if (failures.length > 0) {
        throw new AggregateError(failures, "Cleanup failed");
    }
};

const runCleanup = async (): Promise<void> => {
    try {
        await runCleanupCallbacks(cleanupQueue);
    } finally {
        cleanupQueue.clear();
    }
};

export { addToCleanupQueue, runCleanup, runCleanupCallbacks };
