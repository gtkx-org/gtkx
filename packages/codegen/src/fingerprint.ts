import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ElementProp } from "@gtkx/config";
import { sortedStrings } from "@gtkx/utils";

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
    hash.update(sortedStrings(libraries).join(","));
    for (const file of sortedStrings(girFiles)) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }
    return hash.digest("hex");
};
