import { defineCommand } from "citty";
import { preflightCodegen, resolveConfigWatch } from "../codegen/run-codegen.js";
import { type DevWatch, runDevSupervisor } from "../dev/supervisor.js";
import { runCommand } from "../internal/errors.js";
import { entryArg, resolveEntry } from "./entry.js";

export const dev = defineCommand({
    meta: {
        name: "dev",
        description: "Start development server with HMR",
    },
    args: {
        ...entryArg,
    },
    async run({ args }) {
        await runCommand(async () => {
            const { cwd, entry: entryPath } = resolveEntry(args);

            await preflightCodegen(cwd);

            const watch: DevWatch | undefined = await resolveConfigWatch(cwd);

            await runDevSupervisor(entryPath, watch);
        });
    },
});
