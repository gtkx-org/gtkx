import type { Container } from "./traversal.js";

export type Config = {
    throwSuggestions: boolean;

    getElementError: (message: string, container?: Container) => Error;

    asyncUtilTimeout: number;
};

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
};

let currentConfig: Config = { ...defaultConfig };

export const getConfig = (): Config => {
    return currentConfig;
};

export const configure = (newConfig: Partial<Config> | ConfigFn): void => {
    const updates = typeof newConfig === "function" ? newConfig(currentConfig) : newConfig;
    currentConfig = { ...currentConfig, ...updates };
};
