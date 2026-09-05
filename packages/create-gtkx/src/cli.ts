import { defineCommand, runMain } from "citty";
import packageManifest from "../package.json" with { type: "json" };
import { scaffoldCommand } from "./command.js";

const version = packageManifest.version;

const main = defineCommand({
    ...scaffoldCommand,
    meta: {
        name: "create-gtkx",
        version,
        description: "Scaffold a new Adwaita-first GNOME application with GTKX",
    },
});

void runMain(main);
