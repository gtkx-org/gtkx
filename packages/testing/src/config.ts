import type { Container } from "./traversal.js";

/**
 * Wraps an async test utility (e.g. `waitFor`) so callers can run it inside an environment such as
 * React `act()`.
 */
export type AsyncWrapper = <T>(callback: () => Promise<T>) => Promise<T>;

/**
 * Wraps a synchronous event dispatch so callers can run it inside an environment such as React
 * `act()`. The returned value may be a promise when the wrapper performs async flushing.
 */
export type EventWrapper = (callback: () => void) => void | Promise<void>;

/**
 * Mutable configuration for the testing harness, mirroring the dom/react testing-library config.
 */
export type Config = {
    /** Whether query failures include better-query suggestions in their message. */
    showSuggestions: boolean;

    /** Whether a successful query throws when a better query is available. */
    throwSuggestions: boolean;

    /** Builds the error thrown by failed queries, optionally embedding the rendered tree. */
    getElementError: (message: string, container?: Container) => Error;

    /** Default timeout, in milliseconds, for async utilities. */
    asyncUtilTimeout: number;

    /** Wrapper applied around async utilities such as `waitFor`. */
    asyncWrapper: AsyncWrapper;

    /** Wrapper applied around synchronous event dispatch such as `fireEvent`. */
    eventWrapper: EventWrapper;
};

/**
 * A config updater: receives the current config and returns the partial overrides to apply.
 */
export type ConfigFn = (existingConfig: Config) => Partial<Config>;

const defaultGetElementError = (message: string, _container?: Container): Error => {
    return new Error(message);
};

const defaultConfig: Config = {
    showSuggestions: true,
    throwSuggestions: false,
    getElementError: defaultGetElementError,
    asyncUtilTimeout: 1000,
    asyncWrapper: (callback) => callback(),
    eventWrapper: (callback) => callback(),
};

let currentConfig: Config = { ...defaultConfig };

/**
 * Returns the current harness configuration.
 *
 * @returns The active {@link Config}.
 */
export const getConfig = (): Config => {
    return currentConfig;
};

/**
 * Applies configuration overrides, either as a partial object or an updater function.
 *
 * @param newConfig - The partial overrides, or a function producing them from the current config.
 */
export const configure = (newConfig: Partial<Config> | ConfigFn): void => {
    const updates = typeof newConfig === "function" ? newConfig(currentConfig) : newConfig;
    currentConfig = { ...currentConfig, ...updates };
};
