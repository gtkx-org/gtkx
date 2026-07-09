import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { PositionalArgDef, StringArgDef } from "citty";

const DEFAULT_ENTRY_BASE = "src/index";
const DEFAULT_ENTRY_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];
const DEFAULT_ENTRY = `${DEFAULT_ENTRY_BASE}{${DEFAULT_ENTRY_EXTENSIONS.join(",")}}`;

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

const resolveDefaultEntry = (cwd: string): string => {
    for (const extension of DEFAULT_ENTRY_EXTENSIONS) {
        const candidate = resolve(cwd, `${DEFAULT_ENTRY_BASE}${extension}`);
        if (existsSync(candidate)) return candidate;
    }
    return resolve(cwd, `${DEFAULT_ENTRY_BASE}${DEFAULT_ENTRY_EXTENSIONS[0]}`);
};

export const resolveEntry = (args: { entry?: string; cwd?: string }): { cwd: string; entry: string } => {
    const cwd = resolveCwd(args);
    return { cwd, entry: args.entry ? resolve(cwd, args.entry) : resolveDefaultEntry(cwd) };
};
