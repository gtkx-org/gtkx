import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const MODULE_EXTENSIONS = [".js", ".ts"];
const MODULE_HASH_LENGTH = 16;
const UNKNOWN_MODULE = "unknown";

const moduleHash = (base: string): string => {
    for (const extension of MODULE_EXTENSIONS) {
        try {
            const contents = readFileSync(`${base}${extension}`);

            return createHash("sha256").update(contents).digest("hex").slice(0, MODULE_HASH_LENGTH);
        } catch {
            continue;
        }
    }

    return UNKNOWN_MODULE;
};

export { moduleHash };
