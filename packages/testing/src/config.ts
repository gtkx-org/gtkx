import type { Container } from "./traversal.js";

/**
 * Global configuration for the testing harness, controlling query behavior,
 * error formatting, and the timeouts used by async utilities and actionability
 * checks.
 */
type Config = {
    /** Whether a successful query throws instead, naming a better query, when one is available. */
    throwSuggestions: boolean;

    /** Builds the error thrown when a query fails, given a message and optional container. */
    getElementError: (message: string, container?: Container) => Error;

    /** Default timeout in milliseconds for async utilities such as waitFor. */
    asyncUtilTimeout: number;

    /** Timeout in milliseconds a user event waits for its widget to become actionable. */
    actionabilityTimeout: number;

    /**
     * Timeout in milliseconds `render` waits for the window it shows the tree in to be laid out and
     * activated. A window becoming active is a round trip through the compositor rather than an
     * in-process check, so this is far longer than {@link Config.actionabilityTimeout}: it bounds
     * how long a window that never activates takes to report, and costs nothing when one does.
     */
    windowActivationTimeout: number;
};

/**
 * Function form of a configuration update: receives the current config and
 * returns the fields to override.
 */
type ConfigFn = (existingConfig: Config) => Partial<Config>;

const defaultConfig: Config = {
    throwSuggestions: false,
    getElementError: defaultGetElementError,
    asyncUtilTimeout: 1000,
    actionabilityTimeout: 500,
    windowActivationTimeout: 5000,
};

const currentConfig: Config = { ...defaultConfig };

function defaultGetElementError(message: string): Error {
    return new ElementError(message);
}

/**
 * Returns the current global testing configuration.
 */
const getConfig = (): Config => currentConfig;

/**
 * Merges the given overrides into the global testing configuration.
 *
 * @param newConfig Either a partial config object or a function that receives
 * the current config and returns the fields to override.
 */
const configure = (newConfig: Partial<Config> | ConfigFn): void => {
    const updates = typeof newConfig === "function" ? newConfig(currentConfig) : newConfig;
    Object.assign(currentConfig, updates);
};

class ElementError extends Error {
    override name = "ElementError";
}

export { getConfig, configure, type Config, type ConfigFn };
