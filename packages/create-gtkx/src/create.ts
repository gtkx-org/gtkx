import { defaultScaffolderDeps } from "./deps.js";
import { type CreateOptions, scaffold } from "./scaffolder.js";

export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    await scaffold(defaultScaffolderDeps(), options);
};
