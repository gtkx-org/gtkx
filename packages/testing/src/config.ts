import type { Container } from "./traversal.js";

export type AsyncWrapper = <T>(callback: () => Promise<T>) => Promise<T>;

export type EventWrapper = (callback: () => void) => void | Promise<void>;

export type Config = {
    showSuggestions: boolean;

    throwSuggestions: boolean;

    getElementError: (message: string, container?: Container) => Error;

    asyncUtilTimeout: number;

    asyncWrapper: AsyncWrapper;

    eventWrapper: EventWrapper;
};

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

export const getConfig = (): Config => {
    return currentConfig;
};

export const configure = (newConfig: Partial<Config> | ConfigFn): void => {
    const updates = typeof newConfig === "function" ? newConfig(currentConfig) : newConfig;
    currentConfig = { ...currentConfig, ...updates };
};
