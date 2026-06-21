/**
 * A teardown function registered with the cleanup queue. May be synchronous or asynchronous.
 */
export type CleanupFunction = () => void | Promise<void>;

const cleanupQueue = new Set<CleanupFunction>();

/**
 * Registers a teardown function to be run by {@link runCleanup}.
 *
 * @param fn - The teardown function to enqueue.
 */
export const addToCleanupQueue = (fn: CleanupFunction): void => {
    cleanupQueue.add(fn);
};

/**
 * Runs every registered teardown function in registration order, awaiting each, then clears the
 * queue. Each registrant runs exactly once per invocation.
 *
 * @returns A promise that resolves once all teardown functions have completed.
 */
export const runCleanup = async (): Promise<void> => {
    for (const fn of cleanupQueue) {
        await fn();
    }
    cleanupQueue.clear();
};
