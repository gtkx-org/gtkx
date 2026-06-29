import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

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
