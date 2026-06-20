import { defineCommand } from "citty";
import { preflightCodegen, resolveConfigWatch } from "../codegen/run-codegen.js";
import { type DevWatch, runDevSupervisor } from "../dev/supervisor.js";
import { entryArg, resolveEntry } from "./entry.js";

/**
 * `gtkx dev` — start the development server with HMR.
 *
 * Resolves the user's entry module (defaulting to `src/index.tsx`), runs
 * codegen preflight to refresh generated bindings, and hands off to
 * {@link runDevSupervisor}, which forks and supervises the dev runner. The
 * supervisor watches `gtkx.config.ts`; editing it (e.g. the `libraries` list)
 * regenerates the bindings and restarts the runner.
 */
export const dev = defineCommand({
    meta: {
        name: "dev",
        description: "Start development server with HMR",
    },
    args: {
        ...entryArg,
    },
    async run({ args }) {
        const { cwd, entry: entryPath } = resolveEntry(args);

        await preflightCodegen(cwd);

        const watch: DevWatch | undefined = await resolveConfigWatch(cwd);

        await runDevSupervisor(entryPath, watch);
    },
});
