import type * as Gtk from "@gtkx/gi/gtk";
import type { WaitForOptions } from "./types.js";
import { runWithActEnvironment } from "./act.js";
import { getConfig } from "./config.js";
import { timeoutError } from "./errors.js";

type PollResult<T> = { status: "resolved"; value: T } | { status: "timedout"; lastError: Error | null };
type RemovalTarget = Gtk.Widget | Gtk.Widget[] | null;
type ElementOrCallback = Gtk.Widget | Gtk.Widget[] | (() => RemovalTarget);

const DEFAULT_INTERVAL = 50;
const ELEMENT_NOT_REMOVED = new Error("Element not yet removed");

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const copyStackTrace = (target: Error, source: Error): void => {
    const { stack } = source;

    if (stack === undefined) {
        return;
    }

    const index = stack.indexOf(source.message);

    if (index === -1) {
        target.stack = stack;

        return;
    }

    target.stack = stack.slice(0, index) + target.message + stack.slice(index + source.message.length);
};

const pollUntilSuccess = async <T>(
    callback: () => T | Promise<T>,
    timeout: number,
    interval: number,
): Promise<PollResult<T>> => {
    const startTime = Date.now();
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeout) {
        try {
            const result = await callback();
            await delay(0);

            return { status: "resolved", value: result };
        } catch (error) {
            lastError = error as Error;
            await delay(interval);
        }
    }

    return { status: "timedout", lastError };
};

const buildTimeoutError = (
    timeout: number,
    lastError: Error | null,
    stackTraceError: Error,
    onTimeout: ((error: Error) => Error) | undefined,
): Error => {
    const error = timeoutError(timeout, lastError);
    const finalError = onTimeout ? onTimeout(error) : error;
    copyStackTrace(finalError, stackTraceError);

    return finalError;
};

/**
 * Repeatedly invokes a callback until it succeeds without throwing or the
 * timeout elapses, retrying on each rejection at a fixed interval.
 *
 * @param callback The assertion or query to retry; its resolved value is returned.
 * @param options Optional timeout, interval, and timeout error customization.
 * @returns The callback's result once it succeeds.
 */
const waitFor = <T>(callback: () => T | Promise<T>, options?: WaitForOptions): Promise<T> => {
    if (typeof callback !== "function") {
        throw new TypeError("Received `callback` arg must be a function");
    }

    const stackTraceError = options?.stackTraceError ?? new Error("STACK_TRACE_MESSAGE");

    return Promise.resolve(
        runWithActEnvironment(false, async () => {
            const config = getConfig();
            const { timeout = config.asyncUtilTimeout, interval = DEFAULT_INTERVAL, onTimeout } = options ?? {};
            const result = await pollUntilSuccess(callback, timeout, interval);

            if (result.status === "resolved") {
                return result.value;
            }

            throw buildTimeoutError(timeout, result.lastError, stackTraceError, onTimeout);
        }),
    );
};

const getTarget = (elementOrCallback: ElementOrCallback): RemovalTarget =>
    typeof elementOrCallback === "function" ? elementOrCallback() : elementOrCallback;

const isWidgetRemoved = (widget: Gtk.Widget | null): boolean => {
    if (widget === null) {
        return true;
    }

    try {
        return widget.getRoot() === null;
    } catch {
        return true;
    }
};

const isTargetRemoved = (target: RemovalTarget): boolean => {
    if (Array.isArray(target)) {
        return target.every((widget) => isWidgetRemoved(widget));
    }

    return isWidgetRemoved(target);
};

/**
 * Waits until the given widget or widgets are detached from the tree. Rejects
 * immediately if the target is already absent when called.
 *
 * @param elementOrCallback The widget, array of widgets, or a function
 * returning them to observe for removal.
 * @param options Optional timeout and interval settings.
 */
const waitForElementToBeRemoved = (
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
            if (!isTargetRemoved(getTarget(elementOrCallback))) {
                throw ELEMENT_NOT_REMOVED;
            }
        },
        { ...options, stackTraceError },
    );
};

export { waitFor, waitForElementToBeRemoved };
