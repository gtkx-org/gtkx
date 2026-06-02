import { resolve } from "node:path";
import { createDevRunner } from "./runner.js";

const ENTRY_ARG_INDEX = 2;

/**
 * Runner entry point invoked by the CLI supervisor.
 *
 * Reads the entry path from `process.argv`, builds the production runner via
 * a dynamic import of `runner-deps.ts`, and runs it. Exits with code `1`
 * if the supervisor failed to pass an entry path.
 */
export const main = async (): Promise<void> => {
    const cwd = process.cwd();
    const entryArg = process.argv[ENTRY_ARG_INDEX];

    if (!entryArg) {
        console.error("[gtkx-dev-runner] Missing entry argument");
        process.exit(1);
    }

    const entryPath = resolve(cwd, entryArg);
    const { defaultDevRunnerDeps } = await import("./runner-deps.js");
    const runner = createDevRunner(defaultDevRunnerDeps());
    await runner.run(entryPath);
};
