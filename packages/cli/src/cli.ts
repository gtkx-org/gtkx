import { defineCommand, runCommand } from "citty";
import { printError } from "./internal/errors.js";
import { version } from "./version.js";

export const main = defineCommand({
    meta: {
        name: "gtkx",
        version,
        description: "CLI for GTKX - create and develop GTK4 React applications",
    },
    subCommands: {
        dev: () => import("./commands/dev.js").then((m) => m.dev),
        build: () => import("./commands/build.js").then((m) => m.build),
        codegen: () => import("./commands/codegen.js").then((m) => m.codegen),
        create: () => import("create-gtkx").then((m) => m.createCommand),
    },
});

try {
    await runCommand(main, { rawArgs: process.argv.slice(2) });
} catch (cause) {
    printError(cause);
}
