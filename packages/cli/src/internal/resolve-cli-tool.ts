import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

const resolveCliTool = (() => {
    const cache: Map<string, string> = new Map();

    return (executable: string): string => {
        const cached = cache.get(executable);

        if (cached) {
            return cached;
        }

        const resolved = findInPath(executable);
        cache.set(executable, resolved);

        return resolved;
    };
})();

const isExecutableFile = (candidate: string): boolean => existsSync(candidate) && statSync(candidate).isFile();

const findInPath = (executable: string): string => {
    const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);

    for (const dir of dirs) {
        const candidate = join(dir, executable);

        if (isExecutableFile(candidate)) {
            return candidate;
        }
    }

    throw new Error(`${executable} not found in PATH`);
};

export { resolveCliTool };
