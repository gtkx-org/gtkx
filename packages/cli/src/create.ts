import { defaultScaffolderDeps } from "./create/deps.js";
import type { CreateOptions } from "./create/scaffolder.js";
import { createScaffolder } from "./create/scaffolder.js";

/**
 * Scaffolds a new GTKX project, prompting interactively for any options not
 * supplied on the command line.
 *
 * Wires the {@link createScaffolder} factory to the real filesystem, the
 * `@clack/prompts` TTY, `nypm` for dependency installation, and `tinyexec`
 * for git initialization. Tests construct their own scaffolder with mock
 * collaborators and call `scaffolder.run` directly.
 *
 * @param options - Pre-filled options that bypass the corresponding prompts.
 *
 * @example
 * ```ts
 * import { createApp } from "@gtkx/cli";
 *
 * await createApp({
 *   name: "my-app",
 *   applicationId: "com.example.myapp",
 *   packageManager: "pnpm",
 *   testing: "vitest",
 * });
 * ```
 */
export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    const scaffolder = createScaffolder(defaultScaffolderDeps());
    await scaffolder.run(options);
};
