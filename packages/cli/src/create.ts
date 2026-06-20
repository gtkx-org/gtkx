import { defaultScaffolderDeps } from "./create/deps.js";
import type { CreateOptions } from "./create/scaffolder.js";
import { createScaffolder } from "./create/scaffolder.js";

export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    const scaffolder = createScaffolder(defaultScaffolderDeps());
    await scaffolder.run(options);
};
