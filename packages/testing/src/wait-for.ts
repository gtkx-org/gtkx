import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { timeoutError } from "./errors.js";
import { getIsReactActEnvironment, setIsReactActEnvironment } from "./timing.js";
import type { WaitForOptions } from "./types.js";

const DEFAULT_INTERVAL = 50;

/**
 * Drains the JS microtask queue by yielding one `setTimeout(0)` round.
 *
 * Mirrors {@link https://github.com/testing-library/react-testing-library/blob/main/src/pure.js | RTL's `asyncWrapper`} drain step: any in-flight promises scheduled while
 * `IS_REACT_ACT_ENVIRONMENT` was cleared get a chance to settle before the
 * caller re-enters an act-tracked scope.
 */
const drainMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Runs an async callback with `IS_REACT_ACT_ENVIRONMENT` cleared, draining the
 * microtask queue once it resolves before restoring the previous flag value.
 *
 * Direct port of {@link https://github.com/testing-library/react-testing-library/blob/main/src/pure.js | RTL's `asyncWrapper`}; used by every async utility in this package so
 * that polling code does not capture React state updates as part of an
 * accidental act scope, and so callers regain control with a clean microtask
 * queue.
 */
const asyncWrapper = async <T>(callback: () => Promise<T>): Promise<T> => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(false);
    try {
        const result = await callback();
        await drainMicrotasks();
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
        return widget.getRoot() === null;
    } catch {
        return true;
    }
};

/**
 * Waits for a widget to be removed from the widget tree.
 *
 * Polls until the widget no longer belongs to a root — the GTK analog of no
 * longer being contained in the document — or no longer exists. A widget
 * detached together with an ancestor counts as removed even though it keeps
 * its direct parent.
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
