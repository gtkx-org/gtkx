import { reapStaleHeadlessDisplaysAtStartup } from "@gtkx/vitest/headless";
import { defineCommand } from "citty";
import { ensureGeneratedIn, resolveConfigWatch } from "../codegen/run-codegen.js";
import { resolveCodegenContext } from "../codegen/store-resolver.js";
import { startHeadlessDevDisplay } from "../dev/headless.js";
import { runDevSupervisor } from "../dev/supervisor.js";
import { splitApplicationArgs } from "../internal/application-args.js";
import { configArg, cwdArg, resolveCwd } from "../internal/entry-arg.js";
import { prepareStorybookFiles } from "../storybook/config.js";
import { createStorybookEntry } from "../storybook/entry.js";

const DEV_MODE = "development";

const createStorybookCommand = (options: { signal?: AbortSignal; applicationArgs?: string[] } = {}) =>
    defineCommand({
        meta: {
            name: "storybook",
            description: "Explore native component stories with controls and hot reload",
        },
        args: {
            ...cwdArg,
            ...configArg,
            "storybook-config": {
                type: "string",
                description: "Project-relative story configuration (default: .storybook/main.*)",
            },
            headless: {
                type: "boolean",
                description: "Run on an isolated headless Wayland display",
            },
            size: {
                type: "string",
                description: "Headless display size as WIDTHxHEIGHT",
            },
        },
        async run({ args, rawArgs }) {
            reapStaleHeadlessDisplaysAtStartup();
            if (args.size !== undefined && !args.headless) {
                throw new Error("--size requires --headless");
            }

            const cwd = resolveCwd(args);
            await prepareStorybookFiles(cwd, args["storybook-config"]);
            const context = await resolveCodegenContext(cwd, DEV_MODE, args.config);
            await ensureGeneratedIn(context, { shouldAnnounce: true, mode: DEV_MODE });
            const entryPath = createStorybookEntry(cwd);
            const watch = await resolveConfigWatch(cwd, DEV_MODE, context.configFile, context.configDependencies);
            const applicationArgs = options.applicationArgs ?? splitApplicationArgs(rawArgs).applicationArgs;
            const stopHeadless = args.headless ? await startHeadlessDevDisplay(args.size) : undefined;

            try {
                return await runDevSupervisor({
                    ...(options.signal === undefined ? {} : { signal: options.signal }),
                    entryPath,
                    cwd,
                    configFile: context.configFile,
                    storybookConfig: args["storybook-config"] ?? "",
                    args: applicationArgs,
                    watch,
                });
            } finally {
                stopHeadless?.();
            }
        },
    });

export { createStorybookCommand };
