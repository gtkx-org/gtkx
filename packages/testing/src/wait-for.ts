import type * as Gtk from "@gtkx/ffi/gtk";
import type { WaitForOptions } from "./types.js";

const DEFAULT_TIMEOUT = 1000;
const DEFAULT_INTERVAL = 50;

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
export const waitFor = async <T>(callback: () => T | Promise<T>, options?: WaitForOptions): Promise<T> => {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};
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

    const timeoutError = new Error(`Timed out after ${timeout}ms. Last error: ${lastError?.message}`);
    if (onTimeout) {
        throw onTimeout(timeoutError);
    }
    throw timeoutError;
};

type ElementOrCallback = Gtk.Widget | (() => Gtk.Widget | null);

const getElement = (elementOrCallback: ElementOrCallback): Gtk.Widget | null => {
    if (typeof elementOrCallback === "function") {
        return elementOrCallback();
    }
    return elementOrCallback;
};

const isElementRemoved = (element: Gtk.Widget | null): boolean => {
    if (element === null) return true;

    try {
        const parent = element.getParent();
        return parent === null;
    } catch {
        return true;
    }
};

/**
 * Waits for an element to be removed from the widget tree.
 *
 * Polls until the element no longer has a parent or no longer exists.
 *
 * @param elementOrCallback - Element or function returning element to watch
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
export const waitForElementToBeRemoved = async (
    elementOrCallback: ElementOrCallback,
    options?: WaitForOptions,
): Promise<void> => {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};

    const initialElement = getElement(elementOrCallback);
    if (initialElement === null || isElementRemoved(initialElement)) {
        throw new Error(
            "Elements already removed: waitForElementToBeRemoved requires elements to be present initially",
        );
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const element = getElement(elementOrCallback);
        if (isElementRemoved(element)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    const timeoutError = new Error(`Timed out after ${timeout}ms waiting for element to be removed.`);
    if (onTimeout) {
        throw onTimeout(timeoutError);
    }
    throw timeoutError;
};
