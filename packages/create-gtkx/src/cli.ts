import { defineCommand, runMain } from "citty";
import { createCommand } from "./command.js";
import { version } from "./version.js";

export const main = defineCommand({
    ...createCommand,
    meta: {
        name: "create-gtkx",
        version,
        description: "Scaffold a new gtkx application",
    },
});

runMain(main);
