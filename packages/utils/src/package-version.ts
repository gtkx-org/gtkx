import { createRequire } from "node:module";

export const packageVersion = (importMetaUrl: string): string =>
    (createRequire(importMetaUrl)("../package.json") as { version: string }).version;
