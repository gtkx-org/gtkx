import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * Resolves the absolute path of a named CLI tool by scanning `PATH` entries.
 *
 * Results are memoized per executable name so repeated calls in the same
 * process incur no additional filesystem I/O.
 *
 * @param executable - Bare filename of the tool (e.g. `"glib-compile-schemas"`)
 * @returns Absolute path to the first matching executable
 * @throws When the executable cannot be found in any `PATH` entry
 */
export const resolveCliTool = (() => {
    const cache = new Map<string, string>();

    return (executable: string): string => {
        const cached = cache.get(executable);
        if (cached) return cached;

        const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
        for (const dir of dirs) {
            const candidate = join(dir, executable);
            if (existsSync(candidate) && statSync(candidate).isFile()) {
                cache.set(executable, candidate);
                return candidate;
            }
        }
        throw new Error(`${executable} not found in PATH`);
    };
})();
