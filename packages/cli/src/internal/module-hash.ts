import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const MODULE_HASH_LENGTH = 16;

const moduleHash = (url: URL): string =>
    createHash("sha256").update(readFileSync(url)).digest("hex").slice(0, MODULE_HASH_LENGTH);

export { moduleHash };
