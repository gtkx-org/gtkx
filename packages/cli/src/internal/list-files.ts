import { type Dirent, lstatSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

type ListedFile = {
    absPath: string;
    rel: string;
};

const isRegularEntry = (entry: Dirent): boolean => entry.isDirectory() || entry.isFile();

const listFilesRecursive = (dir: string, shouldInclude?: (name: string) => boolean): ListedFile[] => {
    const stats = lstatSync(dir, { throwIfNoEntry: false });

    if (stats === undefined) {
        return [];
    }

    if (!stats.isDirectory()) {
        throw new Error(`Cannot list ${dir}: it is not a regular directory`);
    }

    const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
    const irregular = entries.find((entry) => !isRegularEntry(entry));

    if (irregular !== undefined) {
        const path = join(irregular.parentPath, irregular.name);
        throw new Error(`Cannot list ${path}: it is not a regular file or directory`);
    }

    return entries
        .filter((entry) => entry.isFile() && (shouldInclude === undefined || shouldInclude(entry.name)))
        .map((entry) => {
            const absPath = join(entry.parentPath, entry.name);

            return { absPath, rel: relative(dir, absPath) };
        });
};

export { listFilesRecursive, type ListedFile };
