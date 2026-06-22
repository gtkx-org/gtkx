import { defaultScaffolderDeps } from "./deps.js";
import { type CreateOptions, createScaffolder } from "./scaffolder.js";

export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    const scaffolder = createScaffolder(defaultScaffolderDeps());
    await scaffolder.run(options);
};
