import { resolve } from "node:path";
import type { PositionalArgDef, StringArgDef } from "citty";

const DEFAULT_ENTRY = "src/index.tsx";

export const cwdArg: { cwd: StringArgDef } = {
    cwd: {
        type: "string",
        description: "Project root (default: current working directory)",
    },
};

export const entryArg: { entry: PositionalArgDef; cwd: StringArgDef } = {
    entry: {
        type: "positional",
        description: `Entry file (default: ${DEFAULT_ENTRY})`,
        required: false,
    },
    ...cwdArg,
};

export const resolveCwd = (args: { cwd?: string }): string => (args.cwd ? resolve(args.cwd) : process.cwd());

export const resolveEntry = (args: { entry?: string; cwd?: string }): { cwd: string; entry: string } => {
    const cwd = resolveCwd(args);
    return { cwd, entry: resolve(cwd, args.entry ?? DEFAULT_ENTRY) };
};
