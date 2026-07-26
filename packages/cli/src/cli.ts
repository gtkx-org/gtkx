import { packageVersion } from "@gtkx/utils";
import { defineCommand, runMain } from "citty";
import { withErrorBoundary } from "./internal/errors.js";

const version = packageVersion(import.meta.url);

export const main = defineCommand({
    meta: {
        name: "gtkx",
        version,
        description: "CLI for GTKX: create and develop GTK4 React applications",
    },
    subCommands: {
        dev: async () => withErrorBoundary((await import("./commands/dev.js")).dev),
        build: async () => withErrorBoundary((await import("./commands/build.js")).build),
        codegen: async () => withErrorBoundary((await import("./commands/codegen.js")).codegen),
        docs: async () => withErrorBoundary((await import("./commands/docs.js")).docs),
        create: async () => withErrorBoundary((await import("create-gtkx")).createCommand),
    },
});

await runMain(main);
