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

function tryResolveExecutable(command: string): string | undefined {
    if (isAbsolute(command)) {
        return command;
    }

    if (command.includes("/")) {
        return resolve(command);
    }

    return findOnPath(command);
}

function resolveExecutable(command: string): string {
    const found = tryResolveExecutable(command);

    if (found === undefined) {
        throw new Error(`Cannot find the "${command}" executable on PATH`);
    }

    return found;
}

export { resolveExecutable, tryResolveExecutable };
