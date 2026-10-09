import type { ServerOptions } from "@gtkx/mcp/server";
import { defineCommand } from "citty";
import { withErrorBoundary } from "./internal/errors.js";
import packageManifest from "../package.json" with { type: "json" };

type CommandOptions = Pick<ServerOptions, "signal" | "transport" | "socketPath"> & {
    applicationArgs?: string[];
    onError?: (cause: unknown) => never;
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

                return withErrorBoundary(createStorybookCommand(options), options.onError);
            },
            dev: async () => {
                const { createDevCommand } = await import("./commands/dev.js");

                return withErrorBoundary(createDevCommand(options), options.onError);
            },
            build: async () => {
                const { build } = await import("./commands/build.js");

                return withErrorBoundary(build, options.onError);
            },
            deploy: async () => {
                const { deploy } = await import("./commands/deploy.js");

                return withErrorBoundary(deploy, options.onError);
            },
            codegen: async () => {
                const { codegen } = await import("./commands/codegen.js");

                return withErrorBoundary(codegen, options.onError);
            },
            docs: async () => {
                const { docs } = await import("./commands/docs.js");

                return withErrorBoundary(docs, options.onError);
            },
            mcp: async () => {
                const { createMcpCommand } = await import("./commands/mcp.js");

                return withErrorBoundary(createMcpCommand(options), options.onError);
            },
            create: async () => {
                const { scaffoldCommand } = await import("create-gtkx");

                return withErrorBoundary(scaffoldCommand, options.onError);
            },
            cleanup: async () => {
                const { cleanup } = await import("./commands/cleanup.js");

                return withErrorBoundary(cleanup, options.onError);
            },
        },
    });

export { createCommand };
