import type { PositionalArgDef, StringArgDef } from "citty";
import { statSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_ENTRY_BASE = "src/index";
const DEFAULT_ENTRY_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];
const DEFAULT_ENTRY_CANDIDATES = DEFAULT_ENTRY_EXTENSIONS.map((extension) => `${DEFAULT_ENTRY_BASE}${extension}`);
const DEFAULT_ENTRY = `${DEFAULT_ENTRY_BASE}{${DEFAULT_ENTRY_EXTENSIONS.join(",")}}`;

const cwdArg: { cwd: StringArgDef } = {
    cwd: {
        type: "string",
        description: "Project root (default: current working directory)",
    },
};

const configArg: { config: StringArgDef } = {
    config: {
        type: "string",
        description: "Project-relative configuration file (default: gtkx.config.*)",
    },
};

const entryArg: { entry: PositionalArgDef; cwd: StringArgDef } = {
    entry: {
        type: "positional",
        description: `Entry file (default: ${DEFAULT_ENTRY})`,
        required: false,
    },
    ...cwdArg,
};

const resolveCwd = (args: { cwd?: string }): string => (args.cwd ? resolve(args.cwd) : process.cwd());
const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() === true;

const missingDefaultEntryError = (cwd: string): Error =>
    new Error(
        `No entry file found in ${cwd}. Looked for ${DEFAULT_ENTRY_CANDIDATES.join(", ")}; ` +
        "pass the entry file as an argument.",
    );

const resolveDefaultEntry = (cwd: string): string => {
    for (const candidate of DEFAULT_ENTRY_CANDIDATES) {
        const path = resolve(cwd, candidate);

        if (isFile(path)) {
            return path;
        }
    }

    throw missingDefaultEntryError(cwd);
};

const resolveGivenEntry = (cwd: string, entry: string): string => {
    const path = resolve(cwd, entry);

    if (!isFile(path)) {
        throw new Error(`No entry file at ${path}.`);
    }

    return path;
};

const resolveEntry = (cwd: string, entry: string | undefined): string =>
    entry ? resolveGivenEntry(cwd, entry) : resolveDefaultEntry(cwd);

export { configArg, cwdArg, entryArg, resolveCwd, resolveEntry };
