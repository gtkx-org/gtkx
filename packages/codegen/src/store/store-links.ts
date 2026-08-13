import { type ResolvedStore, resolveStore } from "./resolve-store.js";
import { ensureStoreLink } from "./store-fs.js";

const resolveStoreOrNull = (projectRoot: string): ResolvedStore | null => {
    try {
        return resolveStore(projectRoot);
    } catch {
        return null;
    }
};

/**
 * Restores the `node_modules/@gtkx` links of a project's generated stores from whatever is already on
 * disk, generating nothing. A package manager prunes those links on every install, because the store
 * they point at is deliberately absent from the project's `package.json`, and that leaves the bindings
 * unreachable while `node_modules/.gtkx` still holds them intact.
 *
 * Relinking is idempotent: a link that already points at its store is left alone, and a store that was
 * never generated gets no link, so calling this before a resolution costs two `realpath` calls.
 *
 * @param projectRoot Directory holding the project's `package.json`, whose `node_modules` chain is walked.
 */
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
