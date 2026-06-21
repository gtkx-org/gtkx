import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { timeoutError } from "./errors.js";
import type { WaitForOptions } from "./types.js";

const DEFAULT_INTERVAL = 50;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const copyStackTrace = (target: Error, source: Error): void => {
    if (source.stack) {
        target.stack = source.stack.replace(source.message, target.message);
    }
};

/**
 * Repeatedly invokes `callback` until it returns without throwing or the timeout elapses.
 *
 * @typeParam T - The resolved value type of `callback`.
 * @param callback - The assertion or query to retry; its last thrown error is embedded on timeout.
 * @param options - Timeout, polling interval, timeout transform, and stack-trace controls.
 * @returns A promise resolving to `callback`'s value, or rejecting with a timeout error.
 */
export const waitFor = <T>(callback: () => T | Promise<T>, options?: WaitForOptions): Promise<T> => {
    if (typeof callback !== "function") {
        throw new TypeError("Received `callback` arg must be a function");
    }

    const stackTraceError = options?.stackTraceError ?? new Error("STACK_TRACE_MESSAGE");

    return getConfig().asyncWrapper(async () => {
        const config = getConfig();
        const { timeout = config.asyncUtilTimeout, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};
        const startTime = Date.now();
        let lastError: Error | null = null;

        while (Date.now() - startTime < timeout) {
            try {
                return await callback();
            } catch (error) {
                lastError = error as Error;
                await delay(interval);
            }
        }

        const error = timeoutError(timeout, lastError);
        const finalError = onTimeout ? onTimeout(error) : error;
        copyStackTrace(finalError, stackTraceError);
        throw finalError;
    });
};

type RemovalTarget = Gtk.Widget | Gtk.Widget[] | null;

type ElementOrCallback = Gtk.Widget | Gtk.Widget[] | (() => RemovalTarget);

const getTarget = (elementOrCallback: ElementOrCallback): RemovalTarget => {
    if (typeof elementOrCallback === "function") {
        return elementOrCallback();
    }
    return elementOrCallback;
};

const isWidgetRemoved = (widget: Gtk.Widget | null): boolean => {
    if (widget === null) return true;

    try {
        return widget.getRoot() === null;
    } catch {
        return true;
    }
};

const isTargetRemoved = (target: RemovalTarget): boolean => {
    if (Array.isArray(target)) {
        return target.length === 0 || target.every(isWidgetRemoved);
    }
    return isWidgetRemoved(target);
};

const ELEMENT_NOT_REMOVED = new Error("Element not yet removed");

/**
 * Waits until the target element (or elements) is removed from the widget tree.
 *
 * @param elementOrCallback - The element, array of elements, or a callback returning the target(s).
 * @param options - Timeout and polling controls.
 * @returns A promise that resolves once the target is removed, or rejects on timeout.
 */
export const waitForElementToBeRemoved = (
    elementOrCallback: ElementOrCallback,
    options?: WaitForOptions,
): Promise<void> => {
    const stackTraceError = new Error("STACK_TRACE_MESSAGE");
    if (isTargetRemoved(getTarget(elementOrCallback))) {
        return Promise.reject(
            new Error(
                "Element already removed: waitForElementToBeRemoved requires the element to be present initially",
            ),
        );
    }
    return waitFor(
        () => {
            if (!isTargetRemoved(getTarget(elementOrCallback))) throw ELEMENT_NOT_REMOVED;
        },
        { ...options, stackTraceError },
    );
};
