import { assertSupportedNodeVersion } from "@gtkx/config/internal";
import { defineCommand, runMain } from "citty";
import packageManifest from "../package.json" with { type: "json" };
import { splitApplicationArgs } from "./internal/application-args.js";
import { withErrorBoundary } from "./internal/errors.js";

assertSupportedNodeVersion();

const version = packageManifest.version;
const { cliArgs } = splitApplicationArgs(process.argv.slice(2));

const main = defineCommand({
    meta: {
        name: "gtkx",
        version,
        description: "CLI for GTKX: create and develop GTK4 React applications",
    },
    subCommands: {
        dev: async () => {
            const { dev } = await import("./commands/dev.js");

            return withErrorBoundary(dev);
        },
        build: async () => {
            const { build } = await import("./commands/build.js");

            return withErrorBoundary(build);
        },
        deploy: async () => {
            const { deploy } = await import("./commands/deploy.js");

            return withErrorBoundary(deploy);
        },
        codegen: async () => {
            const { codegen } = await import("./commands/codegen.js");

            return withErrorBoundary(codegen);
        },
        docs: async () => {
            const { docs } = await import("./commands/docs.js");

            return withErrorBoundary(docs);
        },
        mcp: async () => {
            const { mcp } = await import("./commands/mcp.js");

            return withErrorBoundary(mcp);
        },
        create: async () => {
            const { scaffoldCommand } = await import("create-gtkx");

            return withErrorBoundary(scaffoldCommand);
        },
    },
});

await runMain(main, { rawArgs: cliArgs });
