#!/usr/bin/env node

/**
 * Generator for the committed public `./env` type entrypoint (`env.d.ts`).
 *
 * The file is the published ambient-module declaration surface for asset
 * imports. Every `declare module "*.<ext>"` block is derived from the single
 * {@link ASSET_EXTENSIONS} source-of-truth list via {@link renderAssetEnvModule}
 * so the declarations can never drift from the asset-matching regexes.
 *
 * Run without arguments to regenerate the committed `env.d.ts`. Run with
 * `--check` to regenerate in memory and exit non-zero when the committed file is
 * stale, mirroring `scripts/sync-ts-references.ts --check`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSET_EXTENSIONS, renderAssetEnvModule } from "../src/vite-plugins/asset-extensions.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(packageRoot, "env.d.ts");

const HEADER = ['/// <reference types="vite/client" />', '/// <reference types="@gtkx/config/env" />'].join("\n");

const CSS_URL_BLOCK = ['declare module "*.css?url" {', "    const path: string;", "    export default path;", "}"].join(
    "\n",
);

const renderEnvDts = (): string => `${[HEADER, renderAssetEnvModule(ASSET_EXTENSIONS), CSS_URL_BLOCK].join("\n\n")}\n`;

const readCommitted = (): string | null => {
    try {
        return readFileSync(envPath, "utf8");
    } catch {
        return null;
    }
};

const relativeEnvPath = (): string => relative(packageRoot, envPath);

const reportStale = (): never => {
    console.error(`${relativeEnvPath()} is out of date.`);
    console.error("Run `pnpm --filter @gtkx/cli generate:env` to regenerate it.");
    process.exit(1);
};

const main = (): void => {
    const desired = renderEnvDts();

    if (process.argv.includes("--check")) {
        if (readCommitted() !== desired) reportStale();
        console.log(`${relativeEnvPath()} is up to date.`);
        return;
    }

    if (readCommitted() === desired) {
        console.log(`${relativeEnvPath()} already up to date.`);
        return;
    }

    writeFileSync(envPath, desired);
    console.log(`Generated ${relativeEnvPath()}.`);
};

main();
