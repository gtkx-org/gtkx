#!/usr/bin/env node

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
