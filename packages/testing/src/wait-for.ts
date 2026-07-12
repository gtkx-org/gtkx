import type * as Gtk from "@gtkx/gi/gtk";
import { runWithActEnvironment } from "./act.js";
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
 * Repeatedly invokes a callback until it succeeds without throwing or the
 * timeout elapses, retrying on each rejection at a fixed interval.
 *
 * @param callback The assertion or query to retry; its resolved value is returned.
 * @param options Optional timeout, interval, and timeout error customization.
 * @returns The callback's result once it succeeds.
 */
export const waitFor = <T>(callback: () => T | Promise<T>, options?: WaitForOptions): Promise<T> => {
    if (typeof callback !== "function") {
        throw new TypeError("Received `callback` arg must be a function");
    }

    const stackTraceError = options?.stackTraceError ?? new Error("STACK_TRACE_MESSAGE");

    return Promise.resolve(
        runWithActEnvironment(false, async () => {
            const config = getConfig();
            const { timeout = config.asyncUtilTimeout, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};
            const startTime = Date.now();
            let lastError: Error | null = null;

            while (Date.now() - startTime < timeout) {
                try {
                    const result = await callback();
                    await delay(0);
                    return result;
                } catch (error) {
                    lastError = error as Error;
                    await delay(interval);
                }
            }

            const error = timeoutError(timeout, lastError);
            const finalError = onTimeout ? onTimeout(error) : error;
            copyStackTrace(finalError, stackTraceError);
            throw finalError;
        }),
    );
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
 * Waits until the given widget or widgets are detached from the tree. Rejects
 * immediately if the target is already absent when called.
 *
 * @param elementOrCallback The widget, array of widgets, or a function
 * returning them to observe for removal.
 * @param options Optional timeout and interval settings.
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
