import type * as Gtk from "@gtkx/ffi/gtk";
import type { WaitForOptions } from "./types.js";

const DEFAULT_TIMEOUT = 1000;
const DEFAULT_INTERVAL = 50;

/**
 * Waits for a callback to succeed without throwing an error.
 * @param callback - Function to execute repeatedly until it succeeds
 * @param options - Wait options (timeout, interval, onTimeout)
 * @returns Promise resolving to the callback's return value
 * @throws If the callback keeps failing after the timeout period
 */
export const waitFor = async <T>(callback: () => T, options?: WaitForOptions): Promise<T> => {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};
    const startTime = Date.now();
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeout) {
        try {
            return callback();
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
 * @param elementOrCallback - The element to watch or a callback returning the element
 * @param options - Wait options (timeout, interval, onTimeout)
 * @returns Promise resolving when the element is removed
 * @throws If the element is already removed when called, or if timeout is reached
 */
export const waitForElementToBeRemoved = async (
    elementOrCallback: ElementOrCallback,
    options?: WaitForOptions,
): Promise<void> => {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};

    const initialElement = getElement(elementOrCallback);
    if (initialElement === null) {
        throw new Error(
            "The element(s) given to waitForElementToBeRemoved are already removed. " +
                "waitForElementToBeRemoved requires that the element is present before waiting for removal.",
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
