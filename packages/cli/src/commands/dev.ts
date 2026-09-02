import { defineCommand } from "citty";
import { resolveConfigWatch } from "../codegen/run-codegen.js";
import { startHeadlessDevDisplay } from "../dev/headless.js";
import { type DevWatch, runDevSupervisor } from "../dev/supervisor.js";
import { splitApplicationArgs } from "../internal/application-args.js";
import { entryArg } from "../internal/entry-arg.js";
import { prepareProject } from "../internal/prepare-project.js";

const DEV_MODE = "development";

const dev = defineCommand({
    meta: {
        name: "dev",
        description: "Start development server with HMR",
    },
    args: {
        ...entryArg,
        headless: {
            type: "boolean",
            description: "Run on an isolated headless Wayland display",
        },
        size: {
            type: "string",
            description: "Headless display size as WIDTHxHEIGHT",
        },
    },
    async run({ args }) {
        if (args.size !== undefined && !args.headless) {
            throw new Error("--size requires --headless");
        }

        const { cwd, entry: entryPath } = await prepareProject(args, DEV_MODE);
        const watch: DevWatch | undefined = await resolveConfigWatch(cwd, DEV_MODE);
        const { applicationArgs } = splitApplicationArgs(process.argv.slice(2));
        const stopHeadless = args.headless ? await startHeadlessDevDisplay(args.size) : undefined;

        try {
            await runDevSupervisor({ entryPath, cwd, args: applicationArgs, watch });
        } finally {
            stopHeadless?.();
        }
    },
});

export { dev };
