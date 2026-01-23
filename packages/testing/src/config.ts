import type { Container } from "./traversal.js";

/**
 * Configuration options for the testing library.
 */
export type Config = {
    /**
     * Whether to show role suggestions in error messages when elements are not found.
     * @default true
     */
    showSuggestions: boolean;

    /**
     * Custom error factory for query failures.
     * Allows customizing how errors are constructed.
     */
    getElementError: (message: string, container: Container) => Error;

    /**
     * Default timeout in milliseconds for async utilities (waitFor, findBy* queries).
     * @default 1000
     */
    asyncUtilTimeout: number;
};

const defaultGetElementError = (message: string, _container: Container): Error => {
    return new Error(message);
};

const defaultConfig: Config = {
    showSuggestions: true,
    getElementError: defaultGetElementError,
    asyncUtilTimeout: 1000,
};

let currentConfig: Config = { ...defaultConfig };

/**
 * Returns the current testing library configuration.
 *
 * @returns The current configuration object
 *
 * @example
 * ```tsx
 * import { getConfig } from "@gtkx/testing";
 *
 * const config = getConfig();
 * console.log(config.showSuggestions);
 * ```
 */
export const getConfig = (): Readonly<Config> => {
    return currentConfig;
};

/**
 * Configures the testing library behavior.
 *
 * Accepts either a partial configuration object or a function that receives
 * the current configuration and returns updates.
 *
 * @param newConfig - Partial configuration or updater function
 *
 * @example
 * ```tsx
 * import { configure } from "@gtkx/testing";
 *
 * // Disable role suggestions
 * configure({ showSuggestions: false });
 *
 * // Use updater function
 * configure((current) => ({
 *   showSuggestions: !current.showSuggestions,
 * }));
 * ```
 */
export const configure = (newConfig: Partial<Config> | ((current: Config) => Partial<Config>)): void => {
    const updates = typeof newConfig === "function" ? newConfig(currentConfig) : newConfig;
    currentConfig = { ...currentConfig, ...updates };
};

/**
 * Resets configuration to defaults.
 * Primarily used for testing.
 *
 * @internal
 */
export const resetConfig = (): void => {
    currentConfig = { ...defaultConfig };
};
