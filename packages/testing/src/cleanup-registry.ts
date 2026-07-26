type CleanupFunction = () => void | Promise<void>;

const cleanupQueue: Set<CleanupFunction> = new Set();

const addToCleanupQueue = (fn: CleanupFunction): void => {
    cleanupQueue.add(fn);
};

const runCleanup = async (): Promise<void> => {
    for (const fn of cleanupQueue) {
        await fn();
    }

    cleanupQueue.clear();
};

export { addToCleanupQueue, runCleanup, type CleanupFunction };
