import { resolve } from "node:path";
import { defineCommand } from "citty";
import { preflightCodegen } from "../codegen/run-codegen.js";
import { runDevSupervisor } from "../dev/supervisor.js";

/**
 * `gtkx dev` — start the development server with HMR.
 *
 * Resolves the user's entry module (defaulting to `src/index.tsx`), runs
 * codegen preflight to refresh generated bindings, and hands off to
 * {@link runDevSupervisor}, which forks and supervises the dev runner.
 */
export const dev = defineCommand({
    meta: {
        name: "dev",
        description: "Start development server with HMR",
    },
    args: {
        entry: {
            type: "positional",
            description: "Entry file (default: src/index.tsx)",
            required: false,
        },
    },
    async run({ args }) {
        const cwd = process.cwd();
        const entryPath = resolve(cwd, args.entry ?? "src/index.tsx");

        await preflightCodegen(cwd);

        await runDevSupervisor(entryPath);
    },
});
