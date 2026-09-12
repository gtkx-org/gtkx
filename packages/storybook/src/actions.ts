import { AsyncLocalStorage } from "node:async_hooks";
import { inspect } from "node:util";
import type { Args, ArgTypes } from "./types.js";

type ActionEntry = {
    id: number;
    name: string;
    args: string[];
    timestamp: number;
    error?: string;
};

/** A named story callback whose arguments can be recorded by the native explorer. */
type ActionCallback = (...args: unknown[]) => void;
type EventCallback = (...args: unknown[]) => unknown;

const actionNames: WeakMap<object, string> = new WeakMap();
const actionScope: AsyncLocalStorage<ActionStore> = new AsyncLocalStorage();
const DEFAULT_HISTORY_LIMIT = 100;
const MAX_ARGUMENT_LENGTH = 400;

const objectLabel = (value: unknown): string | undefined => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    const prototype: unknown = Object.getPrototypeOf(value);

    if (prototype === null || typeof prototype !== "object" || prototype === Object.prototype) {
        return undefined;
    }

    const constructor: unknown = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;

    return typeof constructor === "function" ? `[${constructor.name}]` : "[Object]";
};

const formatArgument = (value: unknown): string => {
    try {
        const label = objectLabel(value);

        if (label !== undefined) {
            return label;
        }

        return inspect(value, {
            depth: 1,
            maxArrayLength: 5,
            maxStringLength: 120,
            customInspect: false,
            getters: false,
            breakLength: Infinity,
        }).slice(0, MAX_ARGUMENT_LENGTH);
    } catch {
        return "[Unreadable value]";
    }
};

/**
 * Creates a named action for a story's callback arguments.
 * The explorer records bounded argument summaries; calls outside its action scope have no effect.
 *
 * @param name Nonempty label displayed in the Actions panel.
 * @returns A callback to supply in story args.
 * @throws If the name is empty or contains only whitespace.
 */
const action = (name: string): ActionCallback => {
    if (name.trim().length === 0) {
        throw new TypeError("An action needs a name");
    }

    const callback: ActionCallback = (...args) => {
        actionScope.getStore()?.record(name, args);
    };
    actionNames.set(callback, name);

    return callback;
};

class ActionStore {
    private entries: ActionEntry[] = [];
    private listeners: Set<() => void> = new Set();
    private nextId = 0;
    private limit: number;

    getSnapshot = (): ActionEntry[] => this.entries;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    };

    clear = (): void => {
        this.publish([]);
    };

    constructor(limit: number = DEFAULT_HISTORY_LIMIT) {
        if (!Number.isSafeInteger(limit) || limit < 1) {
            throw new RangeError("Action history needs a positive integer limit");
        }

        this.limit = limit;
    }

    private publish(entries: ActionEntry[]): void {
        this.entries = entries;

        for (const listener of this.listeners) {
            listener();
        }
    }

    record(name: string, args: unknown[], error?: Error): void {
        const entry: ActionEntry = {
            id: this.nextId++,
            name,
            args: args.slice(0, 8).map((value) => formatArgument(value)),
            timestamp: Date.now(),
            ...(error !== undefined && { error: error.message }),
        };
        this.publish([...this.entries, entry].slice(-this.limit));
    }
}

type CallbackOptions = { callback?: EventCallback; name?: string; argument: string; onError?: (error: Error) => void };

const settleCallback = async (result: Promise<unknown>, fail: (cause: unknown) => void): Promise<unknown> => {
    try {
        return await result;
    } catch (error) {
        fail(error);

        return undefined;
    }
};

const bindCallback = (
    store: ActionStore,
    options: CallbackOptions,
): EventCallback => (...values) => {
    const fail = (cause: unknown): void => {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        store.record(options.name ?? options.argument, values, error);

        if (options.onError === undefined) {
            throw error;
        }

        options.onError(error);
    };

    try {
        const result = actionScope.run(store, () => options.callback?.(...values));

        if (options.name !== undefined) {
            store.record(options.name, values);
        }

        return result instanceof Promise ? settleCallback(result, fail) : result;
    } catch (error) {
        fail(error);

        return;
    }
};

const actionName = (value: unknown, configuredName: unknown): string | undefined => {
    if (typeof configuredName === "string") {
        return configuredName;
    }

    return typeof value === "function" ? actionNames.get(value) : undefined;
};

const isOriginalCallback = (value: unknown): value is EventCallback =>
    typeof value === "function" && !actionNames.has(value);

const callbackOptions = (
    argument: string,
    value: unknown,
    name: string | undefined,
    onError: ((error: Error) => void) | undefined,
): CallbackOptions | undefined => {
    if (typeof value !== "function" && name === undefined) {
        return undefined;
    }

    return {
        argument,
        ...(isOriginalCallback(value) && { callback: value }),
        ...(name !== undefined && { name }),
        ...(onError !== undefined && { onError }),
    };
};

const bindActions = (
    args: Args,
    argTypes: ArgTypes,
    store: ActionStore,
    onError?: (error: Error) => void,
): Args => {
    const bound = { ...args };
    const names = new Set([...Object.keys(args), ...Object.keys(argTypes)]);

    for (const argument of names) {
        const value = args[argument];
        const name = actionName(value, argTypes[argument]?.action);
        const options = callbackOptions(argument, value, name, onError);

        if (options === undefined) {
            continue;
        }

        bound[argument] = bindCallback(store, options);
    }

    return bound;
};

export { action, ActionStore, bindActions };
export type { ActionCallback };
