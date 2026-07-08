import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { ElementProp } from "@gtkx/config";
import { sortStrings } from "@gtkx/utils";

const require = createRequire(import.meta.url);

export const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";

const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;

export type CodegenFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
};

export const computeFingerprint = (
    girFiles: string[],
    libraries: string[],
    elementProps: Record<string, ElementProp[]>,
): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(JSON.stringify(elementProps));
    hash.update("\n");
    hash.update(sortStrings(libraries).join(","));
    for (const file of sortStrings(girFiles)) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }
    return hash.digest("hex");
};

const sortAlpha = (values: string[]): string => sortStrings(values).join(",");

export const isStoreFresh = (
    giStoreDir: string,
    libraries: string[],
    elementProps: Record<string, ElementProp[]>,
): boolean => {
    const sentinelPath = join(giStoreDir, FINGERPRINT_FILENAME);
    if (!existsSync(sentinelPath)) return false;
    let sentinel: CodegenFingerprint;
    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as CodegenFingerprint;
    } catch {
        return false;
    }
    if (sortAlpha(sentinel.libraries) !== sortAlpha(libraries)) return false;
    try {
        return computeFingerprint(sentinel.girFiles, sentinel.libraries, elementProps) === sentinel.value;
    } catch {
        return false;
    }
};
