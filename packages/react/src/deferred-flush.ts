/**
 * Pluggable invocation wrapper for deferred bound-item flushes.
 *
 * List and column controllers coalesce bound-item refreshes that arrive
 * outside a React commit by deferring the flush to a microtask or macrotask.
 * The deferred invocation runs through the wrapper installed here, so a test
 * harness can surround it with React's `act` scope and keep the resulting
 * state updates tracked. The default wrapper invokes the flush directly.
 */

/** Surrounds a deferred flush invocation. */
export type DeferredFlushWrapper = (flush: () => void) => void;

const defaultWrapper: DeferredFlushWrapper = (flush) => {
    flush();
};

let wrapper: DeferredFlushWrapper = defaultWrapper;

/**
 * Installs the wrapper that surrounds deferred bound-item flush invocations.
 *
 * Test harnesses use this to run flushes inside React's `act` scope so the
 * state updates they dispatch are captured by the surrounding test. Passing
 * `null` restores the default wrapper, which invokes the flush directly.
 *
 * @param next - The wrapper to install, or `null` to restore the default
 *
 * @example
 * ```tsx
 * import { setDeferredFlushWrapper } from "@gtkx/react";
 * import { act } from "react";
 *
 * setDeferredFlushWrapper((flush) => {
 *     void act(() => flush());
 * });
 * ```
 */
export const setDeferredFlushWrapper = (next: DeferredFlushWrapper | null): void => {
    wrapper = next ?? defaultWrapper;
};

/**
 * Runs a deferred flush through the installed wrapper.
 *
 * @param flush - The flush to invoke
 */
export const runDeferredFlush = (flush: () => void): void => {
    wrapper(flush);
};
