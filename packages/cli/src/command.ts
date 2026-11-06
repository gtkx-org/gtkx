import type { ServerOptions } from "@gtkx/mcp/server";
import { type ArgsDef, type CommandDef, defineCommand } from "citty";
import { withoutApplicationArgs } from "./internal/application-args.js";
import { withErrorBoundary } from "./internal/errors.js";
import { withKnownOptions } from "./internal/known-options.js";
import packageManifest from "../package.json" with { type: "json" };

type CommandOptions = Pick<ServerOptions, "signal" | "transport" | "socketPath"> & {
    applicationArgs?: string[];
    onError?: (cause: unknown) => never;
};

const withVersionSkewWarning = async <T extends ArgsDef>(command: CommandDef<T>): Promise<CommandDef<T>> => {
    const { withVersionSkewCheck } = await import("./upgrade/version-skew.js");

    return withVersionSkewCheck(command);
};

const createCommand = (options: CommandOptions = {}) => {
    const forwarding = <T extends ArgsDef>(name: string, command: CommandDef<T>): CommandDef<T> =>
        withErrorBoundary(withKnownOptions(name, command, true), options.onError);
    const standalone = <T extends ArgsDef>(name: string, command: CommandDef<T>): CommandDef<T> =>
        withErrorBoundary(
            withKnownOptions(name, withoutApplicationArgs(name, command, options.applicationArgs)),
            options.onError,
        );

    return defineCommand({
        meta: {
            name: "gtkx",
            version: packageManifest.version,
            description: "Create, develop, and package Linux applications with GTKX",
        },
        subCommands: {
            storybook: async () => {
                const { createStorybookCommand } = await import("./commands/storybook.js");

                return forwarding("storybook", await withVersionSkewWarning(createStorybookCommand(options)));
            },
            dev: async () => {
                const { createDevCommand } = await import("./commands/dev.js");

                return forwarding("dev", await withVersionSkewWarning(createDevCommand(options)));
            },
            build: async () => {
                const { build } = await import("./commands/build.js");

                return standalone("build", await withVersionSkewWarning(build));
            },
            deploy: async () => {
                const { deploy } = await import("./commands/deploy.js");

                return standalone("deploy", await withVersionSkewWarning(deploy));
            },
            codegen: async () => {
                const { codegen } = await import("./commands/codegen.js");

                return standalone("codegen", await withVersionSkewWarning(codegen));
            },
            docs: async () => {
                const { docs } = await import("./commands/docs.js");

                return standalone("docs", docs);
            },
            mcp: async () => {
                const { createMcpCommand } = await import("./commands/mcp.js");

                return standalone("mcp", await withVersionSkewWarning(createMcpCommand(options)));
            },
            create: async () => {
                const { scaffoldCommand } = await import("create-gtkx");

                return standalone("create", scaffoldCommand);
            },
            cleanup: async () => {
                const { cleanup } = await import("./commands/cleanup.js");

                return standalone("cleanup", cleanup);
            },
            upgrade: async () => {
                const { upgrade } = await import("./commands/upgrade.js");

                return standalone("upgrade", upgrade);
            },
        },
    });
};

export { createCommand };
