import type * as Gtk from "@gtkx/gi/gtk";
import { runWithActEnvironment } from "./act.js";
import { getConfig } from "./config.js";
import { timeoutError } from "./errors.js";
import type { WaitForOptions } from "./types.js";

const DEFAULT_INTERVAL = 50;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const drainMicrotasks = (): Promise<void> => delay(0);

const asyncWrapper = <T>(callback: () => Promise<T>): Promise<T> =>
    Promise.resolve(
        runWithActEnvironment(false, async () => {
            const result = await callback();
            await drainMicrotasks();
            return result;
        }),
    );

export const waitFor = <T>(callback: () => T | Promise<T>, options?: WaitForOptions): Promise<T> => {
    if (typeof callback !== "function") {
        throw new TypeError("Received `callback` arg must be a function");
    }

    return asyncWrapper(async () => {
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
        if (onTimeout) {
            throw onTimeout(error);
        }
        throw error;
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

export const waitForElementToBeRemoved = (
    elementOrCallback: ElementOrCallback,
    options?: WaitForOptions,
): Promise<void> => {
    if (isTargetRemoved(getTarget(elementOrCallback))) {
        return Promise.reject(
            new Error(
                "Element already removed: waitForElementToBeRemoved requires the element to be present initially",
            ),
        );
    }
    return waitFor(() => {
        if (!isTargetRemoved(getTarget(elementOrCallback))) throw ELEMENT_NOT_REMOVED;
    }, options);
};
