import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { UserTableRows } from "@gtkx/config";
import { sortedAlpha } from "@gtkx/utils";

const require = createRequire(import.meta.url);

export const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";

export const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;

export type CodegenFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
};

const stableValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (typeof value !== "object" || value === null) return value;
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of sortedAlpha(Object.keys(record))) {
        sorted[key] = stableValue(record[key]);
    }
    return sorted;
};

export const serializeUserTables = (tables: UserTableRows): string =>
    JSON.stringify(
        stableValue({
            containerProps: tables.containerProps ?? {},
            arrayProps: tables.arrayProps ?? {},
            objectProps: tables.objectProps ?? {},
            virtualProps: tables.virtualProps ?? {},
            elementMap: tables.elementMap ?? [],
        }),
    );

export const computeFingerprint = (girFiles: string[], libraries: string[], userTables: string): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(sortedAlpha(libraries).join(","));
    hash.update("\n");
    hash.update(userTables);
    for (const file of sortedAlpha(girFiles)) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }
    return hash.digest("hex");
};
