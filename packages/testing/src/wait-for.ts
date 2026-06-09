import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { timeoutError } from "./errors.js";
import { getIsReactActEnvironment, setIsReactActEnvironment, settle } from "./timing.js";
import type { WaitForOptions } from "./types.js";

const DEFAULT_INTERVAL = 50;

/**
 * Runs an async callback with `IS_REACT_ACT_ENVIRONMENT` cleared, then
 * {@link settle}s before restoring the previous flag value.
 *
 * Mirrors {@link https://github.com/testing-library/react-testing-library/blob/main/src/pure.js | RTL's `asyncWrapper`}, with the drain step widened from one
 * `setTimeout(0)` round to a full {@link settle}: GTK delivers virtualized
 * cell binds on its own frame pacing, so the GLib main loop gets a few
 * round-trips to flush the resulting portal re-renders while the act flag is
 * still off, and callers regain control with no framework work left to escape
 * their act tracking.
 */
const asyncWrapper = async <T>(callback: () => Promise<T>): Promise<T> => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(false);
    try {
        const result = await callback();
        await settle();
        return result;
    } finally {
        setIsReactActEnvironment(previousActEnvironment);
    }
};

/**
 * Waits for a callback to succeed.
 *
 * Repeatedly calls the callback until it returns without throwing,
 * or until the timeout is reached.
 *
 * @param callback - Function to execute repeatedly
 * @param options - Timeout and interval configuration
 * @returns Promise resolving to the callback's return value
 *
 * @example
 * ```tsx
 * import { waitFor } from "@gtkx/testing";
 *
 * await waitFor(() => {
 *   expect(counter.value).toBe(5);
 * }, { timeout: 2000 });
 * ```
 */
export const waitFor = <T>(callback: () => T | Promise<T>, options?: WaitForOptions): Promise<T> =>
    asyncWrapper(async () => {
        const config = getConfig();
        const { timeout = config.asyncUtilTimeout, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};
        const startTime = Date.now();
        let lastError: Error | null = null;

        while (Date.now() - startTime < timeout) {
            try {
                return await callback();
            } catch (error) {
                lastError = error as Error;
                await new Promise((resolve) => setTimeout(resolve, interval));
            }
        }

        const error = timeoutError(timeout, lastError);
        if (onTimeout) {
            throw onTimeout(error);
        }
        throw error;
    });

/** @internal */
type ElementOrCallback = Gtk.Widget | (() => Gtk.Widget | null);

const getElement = (elementOrCallback: ElementOrCallback): Gtk.Widget | null => {
    if (typeof elementOrCallback === "function") {
        return elementOrCallback();
    }
    return elementOrCallback;
};

const isElementRemoved = (widget: Gtk.Widget | null): boolean => {
    if (widget === null) return true;

    try {
        const parent = widget.getParent();
        return parent === null;
    } catch {
        return true;
    }
};

/**
 * Waits for a widget to be removed from the widget tree.
 *
 * Polls until the widget no longer has a parent or no longer exists.
 *
 * @param elementOrCallback - Element or function returning widget to watch
 * @param options - Timeout and interval configuration
 *
 * @example
 * ```tsx
 * import { waitForElementToBeRemoved } from "@gtkx/testing";
 *
 * const loader = await screen.findByRole(Gtk.AccessibleRole.PROGRESS_BAR);
 * await waitForElementToBeRemoved(loader);
 * // Loader is now gone
 * ```
 */
export const waitForElementToBeRemoved = (
    elementOrCallback: ElementOrCallback,
    options?: WaitForOptions,
): Promise<void> =>
    asyncWrapper(async () => {
        const config = getConfig();
        const { timeout = config.asyncUtilTimeout, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};

        const initialWidget = getElement(elementOrCallback);
        if (initialWidget === null || isElementRemoved(initialWidget)) {
            throw new Error(
                "Element already removed: waitForElementToBeRemoved requires the element to be present initially",
            );
        }

        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const widget = getElement(elementOrCallback);
            if (isElementRemoved(widget)) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, interval));
        }

        const timeoutError = new Error(`Timed out after ${timeout}ms waiting for element to be removed`);
        if (onTimeout) {
            throw onTimeout(timeoutError);
        }
        throw timeoutError;
    });
