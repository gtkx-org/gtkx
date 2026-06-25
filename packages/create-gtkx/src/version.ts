import { createRequire } from "node:module";

const pkg = createRequire(import.meta.url)("../package.json") as { version: string };

export const version = pkg.version;
