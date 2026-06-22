import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

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

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    void runMain(main);
}
