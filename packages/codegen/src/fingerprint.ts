import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { sortStrings } from "@gtkx/utils";
import { BUILT_IN_ELEMENT_PROP_TYPES, WRAPPER_ELEMENTS } from "./store/react/element-prop-imports.js";

const require = createRequire(import.meta.url);

export const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";

const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;

export type CodegenFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
};

export const computeFingerprint = (girFiles: string[], libraries: string[]): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(JSON.stringify(BUILT_IN_ELEMENT_PROP_TYPES));
    hash.update("\n");
    hash.update(JSON.stringify(WRAPPER_ELEMENTS));
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

export const isStoreFresh = (giStoreDir: string, libraries: string[]): boolean => {
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
        return computeFingerprint(sentinel.girFiles, sentinel.libraries) === sentinel.value;
    } catch {
        return false;
    }
};
