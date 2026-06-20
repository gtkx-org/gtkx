import { resolve } from "node:path";
import type { PositionalArgDef } from "citty";

const DEFAULT_ENTRY = "src/index.tsx";

/**
 * The shared `entry` positional argument the `build` and `dev` commands both
 * declare. Frozen so a command spreads it into its `args` without mutating the
 * canonical descriptor.
 */
export const entryArg: { entry: PositionalArgDef } = Object.freeze({
    entry: {
        type: "positional",
        description: `Entry file (default: ${DEFAULT_ENTRY})`,
        required: false,
    },
});

/**
 * Resolves the working directory and the absolute entry path for a command,
 * applying the shared `src/index.tsx` default when no entry is supplied.
 *
 * @param args - The parsed command arguments carrying the optional `entry`.
 * @returns The current working directory and the resolved entry path.
 */
export const resolveEntry = (args: { entry?: string }): { cwd: string; entry: string } => {
    const cwd = process.cwd();
    return { cwd, entry: resolve(cwd, args.entry ?? DEFAULT_ENTRY) };
};
