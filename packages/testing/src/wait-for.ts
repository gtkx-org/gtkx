import type * as Gtk from "@gtkx/ffi/gtk";
import type { WaitForOptions } from "./types.js";

const DEFAULT_TIMEOUT = 1000;
const DEFAULT_INTERVAL = 50;

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

export const waitForElementToBeRemoved = async (
    elementOrCallback: ElementOrCallback,
    options?: WaitForOptions,
): Promise<void> => {
    const { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};

    const initialElement = getElement(elementOrCallback);
    if (initialElement === null) {
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
