import { type ResolvedStore, resolveStore } from "@gtkx/codegen";
import { existsSync, realpathSync } from "node:fs";

const resolveStoreOrNull = (projectRoot: string): ResolvedStore | null => {
    try {
        return resolveStore(projectRoot);
    } catch {
        return null;
    }
};

/**
 * The links through which a project imports its generated `@gtkx/gi` and `@gtkx/jsx` stores, or none when the
 * project resolves no store.
 */
const storeLinkDirs = (projectRoot: string): string[] => {
    const store = resolveStoreOrNull(projectRoot);

    if (store === null) {
        return [];
    }

    return store.jsx === null ? [store.gi.linkDir] : [store.gi.linkDir, store.jsx.linkDir];
};

/**
 * Identifies the generated stores the links currently lead to. Codegen publishes each regeneration as a new
 * directory, so the identity changes whenever any project sharing the stores regenerates them.
 */
const storeGeneration = (linkDirs: string[]): string =>
    linkDirs.map((linkDir) => (existsSync(linkDir) ? realpathSync(linkDir) : "")).join("\n");

export { storeGeneration, storeLinkDirs };
