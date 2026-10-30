import type { ServerOptions } from "@gtkx/mcp/server";
import { type ArgsDef, type CommandDef, defineCommand } from "citty";
import { withoutApplicationArgs } from "./internal/application-args.js";
import { withErrorBoundary } from "./internal/errors.js";
import packageManifest from "../package.json" with { type: "json" };

type CommandOptions = Pick<ServerOptions, "signal" | "transport" | "socketPath"> & {
    applicationArgs?: string[];
    onError?: (cause: unknown) => never;
};

const withVersionSkewWarning = async <T extends ArgsDef>(
    command: CommandDef<T>,
    onError: CommandOptions["onError"],
): Promise<CommandDef<T>> => {
    const { withVersionSkewCheck } = await import("./upgrade/version-skew.js");

    return withErrorBoundary(withVersionSkewCheck(command), onError);
};

const createCommand = (options: CommandOptions = {}) =>
    defineCommand({
        meta: {
            name: "gtkx",
            version: packageManifest.version,
            description: "Create, develop, and package Linux applications with GTKX",
        },
        subCommands: {
            storybook: async () => {
                const { createStorybookCommand } = await import("./commands/storybook.js");

                return withVersionSkewWarning(createStorybookCommand(options), options.onError);
            },
            dev: async () => {
                const { createDevCommand } = await import("./commands/dev.js");

                return withVersionSkewWarning(createDevCommand(options), options.onError);
            },
            build: async () => {
                const { build } = await import("./commands/build.js");

                return withVersionSkewWarning(
                    withoutApplicationArgs("build", build, options.applicationArgs),
                    options.onError,
                );
            },
            deploy: async () => {
                const { deploy } = await import("./commands/deploy.js");

                return withVersionSkewWarning(
                    withoutApplicationArgs("deploy", deploy, options.applicationArgs),
                    options.onError,
                );
            },
            codegen: async () => {
                const { codegen } = await import("./commands/codegen.js");

                return withVersionSkewWarning(
                    withoutApplicationArgs("codegen", codegen, options.applicationArgs),
                    options.onError,
                );
            },
            docs: async () => {
                const { docs } = await import("./commands/docs.js");

                return withErrorBoundary(
                    withoutApplicationArgs("docs", docs, options.applicationArgs),
                    options.onError,
                );
            },
            mcp: async () => {
                const { createMcpCommand } = await import("./commands/mcp.js");

                return withVersionSkewWarning(
                    withoutApplicationArgs("mcp", createMcpCommand(options), options.applicationArgs),
                    options.onError,
                );
            },
            create: async () => {
                const { scaffoldCommand } = await import("create-gtkx");

                return withErrorBoundary(
                    withoutApplicationArgs("create", scaffoldCommand, options.applicationArgs),
                    options.onError,
                );
            },
            cleanup: async () => {
                const { cleanup } = await import("./commands/cleanup.js");

                return withErrorBoundary(
                    withoutApplicationArgs("cleanup", cleanup, options.applicationArgs),
                    options.onError,
                );
            },
            upgrade: async () => {
                const { upgrade } = await import("./commands/upgrade.js");

                return withErrorBoundary(
                    withoutApplicationArgs("upgrade", upgrade, options.applicationArgs),
                    options.onError,
                );
            },
        },
    });

export { createCommand };
