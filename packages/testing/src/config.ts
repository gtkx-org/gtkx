import type { Container } from "./traversal.js";

/**
 * Global configuration for the testing harness, controlling query behavior,
 * error formatting, and the timeouts used by async utilities and actionability
 * checks.
 */
export type Config = {
    throwSuggestions: boolean;

    /** Builds the error thrown when a query fails, given a message and optional container. */
    getElementError: (message: string, container?: Container) => Error;

    /** Default timeout in milliseconds for async utilities such as waitFor. */
    asyncUtilTimeout: number;

    /** Timeout in milliseconds for waiting on a widget to become actionable. */
    actionabilityTimeout: number;
};

/**
 * Function form of a configuration update: receives the current config and
 * returns the fields to override.
 */
export type ConfigFn = (existingConfig: Config) => Partial<Config>;

const defaultGetElementError = (message: string, _container?: Container): Error => {
    const error = new Error(message);
    error.name = "GtkxElementError";
    return error;
};

const defaultConfig: Config = {
    throwSuggestions: false,
    getElementError: defaultGetElementError,
    asyncUtilTimeout: 1000,
    actionabilityTimeout: 500,
};

let currentConfig: Config = { ...defaultConfig };

/**
 * Returns the current global testing configuration.
 */
export const getConfig = (): Config => {
    return currentConfig;
};

/**
 * Merges the given overrides into the global testing configuration.
 *
 * @param newConfig Either a partial config object or a function that receives
 * the current config and returns the fields to override.
 */
export const configure = (newConfig: Partial<Config> | ConfigFn): void => {
    const updates = typeof newConfig === "function" ? newConfig(currentConfig) : newConfig;
    currentConfig = { ...currentConfig, ...updates };
};
