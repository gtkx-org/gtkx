import { defineCommand, runMain } from "citty";
import { withErrorBoundary } from "./internal/errors.js";
import { version } from "./version.js";

export const main = defineCommand({
    meta: {
        name: "gtkx",
        version,
        description: "CLI for GTKX - create and develop GTK4 React applications",
    },
    subCommands: {
        dev: () => import("./commands/dev.js").then((m) => withErrorBoundary(m.dev)),
        build: () => import("./commands/build.js").then((m) => withErrorBoundary(m.build)),
        codegen: () => import("./commands/codegen.js").then((m) => withErrorBoundary(m.codegen)),
        create: () => import("create-gtkx").then((m) => withErrorBoundary(m.createCommand)),
    },
});

await runMain(main);
