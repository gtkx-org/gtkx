import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";
import { build } from "./commands/build.js";
import { codegen } from "./commands/codegen.js";
import { create } from "./commands/create.js";
import { dev } from "./commands/dev.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

/**
 * Top-level `gtkx` command, assembled from the per-command modules in
 * `src/commands/`.
 *
 * The CLI has two execution edges: the shipped `bin/gtkx.js` (which imports
 * from the compiled `dist/`) and the monorepo's source runner — the root
 * `codegen` script and the `@gtkx/cli#codegen` turbo task both invoke this file
 * directly via tsx, before any build has run. The entry-point check below makes
 * the second path work; the bin handles the first.
 */
export const main = defineCommand({
    meta: {
        name: "gtkx",
        version,
        description: "CLI for GTKX - create and develop GTK4 React applications",
    },
    subCommands: {
        dev,
        build,
        codegen,
        create,
    },
});

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    void runMain(main);
}
