import { defineCommand } from "citty";
import { ensureGenerated, resolveConfigWatch } from "../codegen/run-codegen.js";
import { type DevWatch, runDevSupervisor } from "../dev/supervisor.js";
import { splitApplicationArgs } from "../internal/application-args.js";
import { entryArg, resolveEntry } from "../internal/entry-arg.js";

const DEV_MODE = "development";

const dev = defineCommand({
    meta: {
        name: "dev",
        description: "Start development server with HMR",
    },
    args: {
        ...entryArg,
    },
    async run({ args }) {
        const { cwd, entry: entryPath } = resolveEntry(args);
        await ensureGenerated(cwd, { shouldAnnounce: true, mode: DEV_MODE });
        const watch: DevWatch | undefined = await resolveConfigWatch(cwd, DEV_MODE);
        const { applicationArgs } = splitApplicationArgs(process.argv.slice(2));
        await runDevSupervisor({ entryPath, cwd, args: applicationArgs, watch });
    },
});

export { dev };
