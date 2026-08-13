import type { CollectionIndex, Level } from "../../src/internal/collection-index.js";

const pushChildLevels = (index: CollectionIndex, level: Level, paths: string[], pending: Level[]): void => {
    for (let slot = 0; slot < level.items.length; slot++) {
        const child = index.childLevel(level, slot);

        if (child !== undefined) {
            paths.push(child.path);
            pending.push(child);
        }
    }
};

const expandablePaths = (index: CollectionIndex): string[] => {
    const paths: string[] = [];
    const pending: Level[] = [...index.groups];

    while (pending.length > 0) {
        const level = pending.pop();

        if (level !== undefined) {
            pushChildLevels(index, level, paths, pending);
        }
    }

    return paths;
};

export { expandablePaths };
