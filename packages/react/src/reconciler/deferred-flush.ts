/**
 * Wraps a deferred reconciler flush, allowing callers (e.g. a test harness) to run it inside
 * an environment such as React `act()`.
 */
export type DeferredFlushWrapper = (flush: () => void) => void;

const defaultWrapper: DeferredFlushWrapper = (flush) => {
    flush();
};

let wrapper: DeferredFlushWrapper = defaultWrapper;

/**
 * Installs the wrapper used to run deferred flushes, or resets it to the default when `null`.
 *
 * @param next - The wrapper to install, or `null` to restore the default pass-through wrapper.
 */
export const setDeferredFlushWrapper = (next: DeferredFlushWrapper | null): void => {
    wrapper = next ?? defaultWrapper;
};

/**
 * Runs `flush` through the currently installed {@link DeferredFlushWrapper}.
 *
 * @param flush - The deferred work to execute within the configured wrapper.
 */
export const runDeferredFlush = (flush: () => void): void => {
    wrapper(flush);
};
