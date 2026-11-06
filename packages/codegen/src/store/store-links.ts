import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { type ResolvedStore, resolveStore } from "./resolve-store.js";
import { ensureStoreLink } from "./store-fs.js";
import { ensureStoreViews } from "./store-views.js";

const resolvedStores: Map<string, ResolvedStore> = new Map();

const resolveStoreOrNull = (projectRoot: string): ResolvedStore | null => {
    try {
        return resolveStore(projectRoot);
    } catch {
        return null;
    }
};

const isStoreDirPresent = (store: ResolvedStore): boolean => existsSync(join(store.gi.storeDir, "package.json"));

const storeFor = (projectRoot: string): ResolvedStore | null => {
    const cached = resolvedStores.get(projectRoot);

    if (cached !== undefined && isStoreDirPresent(cached)) {
        return cached;
    }

    const resolved = resolveStoreOrNull(projectRoot);
    resolvedStores.delete(projectRoot);

    if (resolved !== null) {
        resolvedStores.set(projectRoot, resolved);
    }

    return resolved;
};

const ensureStoreLinks = (projectRoot: string): void => {
    const store = storeFor(resolve(projectRoot));

    if (store === null) {
        return;
    }

    for (const unit of [store.gi, store.jsx]) {
        if (unit !== null) {
            ensureStoreLink(unit);
        }
    }

    if (store.gi.owner !== undefined) {
        ensureStoreViews(store.gi.owner, store.gi, store.jsx);
    }
};

export { ensureStoreLinks };
