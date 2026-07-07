import { packageVersion } from "@gtkx/utils";
import { defineCommand, runMain } from "citty";
import { createCommand } from "./command.js";

const version = packageVersion(import.meta.url);

const main = defineCommand({
    ...createCommand,
    meta: {
        name: "create-gtkx",
        version,
        description: "Scaffold a new gtkx application",
    },
});

runMain(main);
