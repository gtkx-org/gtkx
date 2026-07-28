type CleanupFunction = () => void | Promise<void>;

const cleanupQueue: Set<CleanupFunction> = new Set();

const addToCleanupQueue = (fn: CleanupFunction): void => {
    cleanupQueue.add(fn);
};

const runCleanup = async (): Promise<void> => {
    const failures: unknown[] = [];

    for (const fn of cleanupQueue) {
        try {
            await fn();
        } catch (error) {
            failures.push(error);
        }
    }

    cleanupQueue.clear();

    if (failures.length > 0) {
        throw new AggregateError(failures, "Cleanup failed");
    }
};

export { addToCleanupQueue, runCleanup, type CleanupFunction };
