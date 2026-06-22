import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";
import { createCommand } from "./command.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

export const main = defineCommand({
    ...createCommand,
    meta: {
        name: "create-gtkx",
        version,
        description: "Scaffold a new GTKX application",
    },
});

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    void runMain(main);
}
