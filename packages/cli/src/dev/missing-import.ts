import { isRecord } from "@gtkx/utils";
import { basename, dirname, extname } from "node:path";

const LOAD_FAILURE_PATTERN = /Failed to load url (\S+)/;
const INDEX_NAME = "index";
const NAMELESS_URLS = new Set(["", ".", ".."]);

const fileName = (path: string): string => basename(path, extname(path));

const missingImportSource = (cause: unknown): string | undefined => {
    if (isRecord(cause) && cause.code === "GTKX_UNRESOLVED_IMPORT" && typeof cause.specifier === "string") {
        return cause.specifier;
    }

    const message = cause instanceof Error ? cause.message : String(cause);

    return LOAD_FAILURE_PATTERN.exec(message)?.[1];
};

const missingImportName = (cause: unknown): string | null => {
    const url = missingImportSource(cause);

    if (url === undefined) {
        return null;
    }

    const name = fileName(url);

    return NAMELESS_URLS.has(name) ? null : name;
};

const isMissingImport = (createdPath: string, name: string): boolean => {
    const created = fileName(createdPath);

    if (created === name) {
        return true;
    }

    return created === INDEX_NAME && basename(dirname(createdPath)) === name;
};

export { isMissingImport, missingImportName };
