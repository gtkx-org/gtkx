import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { WrittenCatalog } from "../i18n/catalogs.js";

type CatalogWrites = {
    record: (catalogs: WrittenCatalog[]) => void;
    hasWritten: (path: string) => boolean;
};

const hasContent = (path: string, content: Buffer): boolean => {
    try {
        return readFileSync(path).equals(content);
    } catch {
        return false;
    }
};

const createCatalogWrites = (): CatalogWrites => {
    const contents: Map<string, Buffer> = new Map();

    return {
        record: (catalogs) => {
            for (const catalog of catalogs) {
                contents.set(resolve(catalog.path), catalog.content);
            }
        },
        hasWritten: (path) => {
            const content = contents.get(resolve(path));

            return content !== undefined && hasContent(path, content);
        },
    };
};

export { type CatalogWrites, createCatalogWrites };
