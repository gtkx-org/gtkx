import { type ResolvedStore, resolveStore } from "./resolve-store.js";
import { ensureStoreLink } from "./store-fs.js";

const resolveStoreOrNull = (projectRoot: string): ResolvedStore | null => {
    try {
        return resolveStore(projectRoot);
    } catch {
        return null;
    }
};

const ensureStoreLinks = (projectRoot: string): void => {
    const store = resolveStoreOrNull(projectRoot);

    if (store === null) {
        return;
    }

    for (const unit of [store.gi, store.jsx]) {
        if (unit !== null) {
            ensureStoreLink(unit);
        }
    }
};

export { ensureStoreLinks };
