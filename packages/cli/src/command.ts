import type { ServerOptions } from "@gtkx/mcp/server";
import { type ArgsDef, type CommandDef, defineCommand } from "citty";
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

                return withVersionSkewWarning(build, options.onError);
            },
            deploy: async () => {
                const { deploy } = await import("./commands/deploy.js");

                return withVersionSkewWarning(deploy, options.onError);
            },
            codegen: async () => {
                const { codegen } = await import("./commands/codegen.js");

                return withVersionSkewWarning(codegen, options.onError);
            },
            docs: async () => {
                const { docs } = await import("./commands/docs.js");

                return withErrorBoundary(docs, options.onError);
            },
            mcp: async () => {
                const { createMcpCommand } = await import("./commands/mcp.js");

                return withVersionSkewWarning(createMcpCommand(options), options.onError);
            },
            create: async () => {
                const { scaffoldCommand } = await import("create-gtkx");

                return withErrorBoundary(scaffoldCommand, options.onError);
            },
            cleanup: async () => {
                const { cleanup } = await import("./commands/cleanup.js");

                return withErrorBoundary(cleanup, options.onError);
            },
            upgrade: async () => {
                const { upgrade } = await import("./commands/upgrade.js");

                return withErrorBoundary(upgrade, options.onError);
            },
        },
    });

export { createCommand };
