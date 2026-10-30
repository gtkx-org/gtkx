import { warn } from "@gtkx/utils";
import { reapStaleHeadlessDisplaysAtStartup } from "@gtkx/vitest/headless";
import { defineCommand } from "citty";
import { relative } from "node:path";
import { ensureGeneratedIn, resolveConfigWatch } from "../codegen/run-codegen.js";
import { resolveCodegenContext } from "../codegen/store-resolver.js";
import { startHeadlessDevDisplay } from "../dev/headless.js";
import { runDevSupervisor } from "../dev/supervisor.js";
import { splitApplicationArgs } from "../internal/application-args.js";
import { configArg, cwdArg, resolveCwd } from "../internal/entry-arg.js";
import { prepareStorybookFiles } from "../storybook/config.js";
import { assertStorybookInstalled, createStorybookEntry } from "../storybook/entry.js";

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
            assertStorybookInstalled(cwd);
            const { skippedMdx } = await prepareStorybookFiles(cwd, args["storybook-config"]);

            if (skippedMdx.length > 0) {
                warn(
                    `Skipped MDX files, which the Storybook explorer does not support: ${skippedMdx.map((path) => relative(cwd, path)).join(", ")}`,
                );
            }

            const context = await resolveCodegenContext(cwd, DEV_MODE, args.config);
            await ensureGeneratedIn(context, { shouldAnnounce: true, mode: DEV_MODE });
            const entryPath = createStorybookEntry(cwd);
            const watch = await resolveConfigWatch(cwd, DEV_MODE, context.configFile, context.configDependencies);
            const applicationArgs = options.applicationArgs ?? splitApplicationArgs(rawArgs).applicationArgs;
            const headless = args.headless ? await startHeadlessDevDisplay(args.size) : undefined;

            try {
                return await runDevSupervisor({
                    ...(options.signal === undefined ? {} : { signal: options.signal }),
                    entryPath,
                    cwd,
                    configFile: context.configFile,
                    storybookConfig: args["storybook-config"] ?? "",
                    args: applicationArgs,
                    mcpSocketPath: headless?.mcpSocketPath,
                    watch,
                });
            } finally {
                headless?.stop();
            }
        },
    });

export { createStorybookCommand };
