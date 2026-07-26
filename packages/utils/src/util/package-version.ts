import { createRequire } from "node:module";

/**
 * Reads the `version` field from the `package.json` next to the calling module.
 *
 * @param importMetaUrl - The caller's `import.meta.url`, used to resolve the sibling `package.json`.
 * @returns The package's version string.
 *
 * @example
 * packageVersion(import.meta.url); // "1.2.3"
 */
function packageVersion(importMetaUrl: string): string {
    return (createRequire(importMetaUrl)("../package.json") as { version: string }).version;
}

export { packageVersion };
