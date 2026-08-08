import { createRequire } from "node:module";

function packageVersion(importMetaUrl: string, specifier: string): string {
    return (createRequire(importMetaUrl)(specifier) as { version: string }).version;
}

export { packageVersion };
