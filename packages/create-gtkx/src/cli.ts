import { packageVersion } from "@gtkx/utils";
import { defineCommand, runMain } from "citty";
import { scaffoldCommand } from "./command.js";

const version = packageVersion(import.meta.url, "../package.json");

const main = defineCommand({
    ...scaffoldCommand,
    meta: {
        name: "create-gtkx",
        version,
        description: "Scaffold a new GTKX application",
    },
});

void runMain(main);
