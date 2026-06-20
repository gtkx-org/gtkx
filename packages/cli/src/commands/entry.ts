import { resolve } from "node:path";
import type { PositionalArgDef } from "citty";

const DEFAULT_ENTRY = "src/index.tsx";

export const entryArg: { entry: PositionalArgDef } = Object.freeze({
    entry: {
        type: "positional",
        description: `Entry file (default: ${DEFAULT_ENTRY})`,
        required: false,
    },
});

export const resolveEntry = (args: { entry?: string }): { cwd: string; entry: string } => {
    const cwd = process.cwd();
    return { cwd, entry: resolve(cwd, args.entry ?? DEFAULT_ENTRY) };
};
