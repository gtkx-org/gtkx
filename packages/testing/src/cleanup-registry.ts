export type CleanupFunction = () => void | Promise<void>;

const cleanupQueue = new Set<CleanupFunction>();

export const addToCleanupQueue = (fn: CleanupFunction): void => {
    cleanupQueue.add(fn);
};

export const runCleanup = async (): Promise<void> => {
    for (const fn of cleanupQueue) {
        await fn();
    }
    cleanupQueue.clear();
};
