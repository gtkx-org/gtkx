import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { sortStrings } from "@gtkx/utils";
import type { JsxGenerationOptions } from "./store/react/pipeline.js";

const require = createRequire(import.meta.url);

export const FINGERPRINT_FILENAME = ".codegen-fingerprint.json";

const CODEGEN_VERSION: string = (require("../package.json") as { version: string }).version;

export type CodegenFingerprint = {
    value: string;
    girFiles: string[];
    libraries: string[];
    react?: JsxGenerationOptions;
};

const serializeReact = (react: JsxGenerationOptions): string =>
    JSON.stringify([
        [...(react.reactSubexports ?? [])].sort(),
        Object.keys(react.components ?? {})
            .sort()
            .map((type) => [type, react.components?.[type]?.module, react.components?.[type]?.export]),
        Object.entries(react.propInterfaces ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)),
        [...(react.lazyElements ?? [])].sort(),
    ]);

export const computeFingerprint = (
    girFiles: string[],
    libraries: string[],
    react: JsxGenerationOptions = {},
): string => {
    const hash = createHash("sha256");
    hash.update(CODEGEN_VERSION);
    hash.update("\n");
    hash.update(sortStrings(libraries).join(","));
    hash.update("\n");
    hash.update(serializeReact(react));
    for (const file of sortStrings(girFiles)) {
        hash.update("\n");
        hash.update(file);
        hash.update("\0");
        hash.update(readFileSync(file));
    }
    return hash.digest("hex");
};

const sortAlpha = (values: string[]): string => sortStrings(values).join(",");

export const isStoreFresh = (giStoreDir: string, libraries: string[], react: JsxGenerationOptions = {}): boolean => {
    const sentinelPath = join(giStoreDir, FINGERPRINT_FILENAME);
    if (!existsSync(sentinelPath)) return false;
    let sentinel: CodegenFingerprint;
    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as CodegenFingerprint;
    } catch {
        return false;
    }
    if (sortAlpha(sentinel.libraries) !== sortAlpha(libraries)) return false;
    if (serializeReact(sentinel.react ?? {}) !== serializeReact(react)) return false;
    try {
        return computeFingerprint(sentinel.girFiles, sentinel.libraries, sentinel.react ?? {}) === sentinel.value;
    } catch {
        return false;
    }
};
