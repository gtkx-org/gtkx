import { readdirSync, rmSync } from "node:fs";
import * as nodeModule from "node:module";
import { basename, join } from "node:path";
import { cacheRoot } from "./cache-root.js";
import { COMPILE_CACHE_SEGMENT } from "./compile-cache.js";

const RUNTIME_PREFIX = `v${process.versions.node}-${process.arch}-`;

const currentNamespace = (): string | undefined => {
    if (typeof nodeModule.getCompileCacheDir !== "function") {
        return undefined;
    }

    const dir = nodeModule.getCompileCacheDir();

    return dir === undefined ? undefined : basename(dir);
};

const isStale = (name: string, namespace: string | undefined): boolean =>
    namespace === undefined ? !name.startsWith(RUNTIME_PREFIX) : name !== namespace;

const findStaleCompileCaches = (): string[] => {
    const namespace = currentNamespace();
    const dir = join(cacheRoot(), COMPILE_CACHE_SEGMENT);

    try {
        return readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && isStale(entry.name, namespace))
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
