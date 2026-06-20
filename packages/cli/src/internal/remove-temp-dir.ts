import { rmSync } from "node:fs";

/**
 * Recursively removes a temporary directory the CLI staged.
 *
 * `force` ignores an already-absent directory; `maxRetries` rides out the brief
 * locks a concurrent watcher or filesystem indexer can hold on a just-written
 * file, so cleanup is consistent across every staging site.
 *
 * @param dir - Absolute path of the directory to remove.
 */
export const removeTempDir = (dir: string): void => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
};
