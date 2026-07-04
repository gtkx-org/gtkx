import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ResolvedGtkxRules } from "@gtkx/config";
import { sortedStrings } from "@gtkx/utils";

const require = createRequire(import.meta.url);

export const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";

const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;

const METADATA_SCHEMA_VERSION = 2;

export type CodegenFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
};

export const computeFingerprint = (girFiles: string[], libraries: string[], rules: ResolvedGtkxRules): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(String(METADATA_SCHEMA_VERSION));
    hash.update("\n");
    hash.update(JSON.stringify(rules));
    hash.update("\n");
    hash.update(sortedStrings(libraries).join(","));
    for (const file of sortedStrings(girFiles)) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }
    return hash.digest("hex");
};
