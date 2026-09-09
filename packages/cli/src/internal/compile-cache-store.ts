import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cacheRoot } from "./cache-root.js";
import { COMPILE_CACHE_SEGMENT } from "./compile-cache.js";

const currentNamespacePrefix = (): string => `v${process.versions.node}-${process.arch}-`;

const findStaleCompileCaches = (): string[] => {
    const dir = join(cacheRoot(), COMPILE_CACHE_SEGMENT);
    const prefix = currentNamespacePrefix();

    try {
        return readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith(prefix))
            .map((entry) => join(dir, entry.name));
    } catch {
        return [];
    }
};

const reapStaleCompileCaches = (candidates: string[]): string[] => {
    const removed: string[] = [];

    for (const candidate of candidates) {
        try {
            rmSync(candidate, { recursive: true, force: true });
            removed.push(candidate);
        } catch {
            continue;
        }
    }

    return removed;
};

export { findStaleCompileCaches, reapStaleCompileCaches };
