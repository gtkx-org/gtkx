import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";

const isExecutable = (path: string): boolean => {
    try {
        accessSync(path, constants.X_OK);

        return true;
    } catch {
        return false;
    }
};

const findOnPath = (command: string): string | undefined => {
    const searchPaths = (process.env.PATH ?? "").split(delimiter).filter((entry) => entry.length > 0);

    for (const directory of searchPaths) {
        const candidate = join(directory, command);

        if (isExecutable(candidate)) {
            return candidate;
        }
    }

    return undefined;
};

/**
 * Resolves an executable to an absolute path, searching `PATH` only for a bare command name, so
 * spawning it never re-runs a lookup against a `PATH` that may have changed.
 *
 * @param command - An executable name, or a path to one.
 * @returns The absolute path of the executable.
 * @throws When a bare command name is not found on `PATH`.
 *
 * @example
 * resolveExecutable("weston"); // "/usr/bin/weston"
 */
function resolveExecutable(command: string): string {
    if (isAbsolute(command)) {
        return command;
    }

    if (command.includes("/")) {
        return resolve(command);
    }

    const found = findOnPath(command);

    if (found === undefined) {
        throw new Error(`Cannot find the "${command}" executable on PATH`);
    }

    return found;
}

export { resolveExecutable };
