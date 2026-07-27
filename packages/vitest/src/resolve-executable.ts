import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

const isExecutable = (path: string): boolean => {
    try {
        accessSync(path, constants.X_OK);

        return true;
    } catch {
        return false;
    }
};

const resolveExecutable = (command: string): string => {
    if (isAbsolute(command)) {
        return command;
    }

    const searchPaths = (process.env.PATH ?? "").split(delimiter).filter((entry) => entry.length > 0);

    for (const directory of searchPaths) {
        const candidate = join(directory, command);

        if (isExecutable(candidate)) {
            return candidate;
        }
    }

    throw new Error(`Cannot find the "${command}" executable on PATH`);
};

export { resolveExecutable };
