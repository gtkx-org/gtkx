import { packageVersion } from "@gtkx/utils";
import { defineCommand, runMain } from "citty";
import { splitApplicationArgs } from "./internal/application-args.js";
import { withErrorBoundary } from "./internal/errors.js";

const version = packageVersion(import.meta.url, "../package.json");
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
        create: async () => {
            const { scaffoldCommand } = await import("create-gtkx");

            return withErrorBoundary(scaffoldCommand);
        },
    },
});

await runMain(main, { rawArgs: cliArgs });
