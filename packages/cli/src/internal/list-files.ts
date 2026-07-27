import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

type ListedFile = {
    absPath: string;
    rel: string;
};

const listFilesRecursive = (dir: string, shouldInclude?: (name: string) => boolean): ListedFile[] => {
    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && (shouldInclude === undefined || shouldInclude(entry.name)))
        .map((entry) => {
            const absPath = join(entry.parentPath, entry.name);

            return { absPath, rel: relative(dir, absPath) };
        });
};

export { listFilesRecursive, type ListedFile };
