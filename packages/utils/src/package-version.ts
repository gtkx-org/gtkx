import { createRequire } from "node:module";

/**
 * Reads the `version` field from the `package.json` next to the calling module.
 *
 * @param importMetaUrl The caller's `import.meta.url`, used to resolve the sibling `package.json`.
 */
export const packageVersion = (importMetaUrl: string): string =>
    (createRequire(importMetaUrl)("../package.json") as { version: string }).version;
