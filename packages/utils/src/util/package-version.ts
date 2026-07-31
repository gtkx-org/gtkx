import { createRequire } from "node:module";

function packageVersion(importMetaUrl: string): string {
    return (createRequire(importMetaUrl)("../package.json") as { version: string }).version;
}

export { packageVersion };
