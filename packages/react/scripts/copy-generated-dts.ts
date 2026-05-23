#!/usr/bin/env node
/**
 * Copies every `src/generated/<name>.d.ts` source declaration file into
 * `dist/generated/<name>.d.ts`, overwriting the weak declaration tsc emits
 * from the corresponding `<name>.js` input.
 *
 * The codegen pipeline writes the authoritative type contract as a hand-
 * crafted `.d.ts` next to the generated `.js`, but tsc with `allowJs` only
 * understands the JS input and synthesises a permissive declaration from
 * its inferred shape. Copying the source `.d.ts` ensures consumer projects
 * see the contract — including the `JSX.IntrinsicElements` augmentation —
 * rather than the inferred one.
 */

import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);
const generatedSrc = join(packageRoot, "src", "generated");
const generatedDist = join(packageRoot, "dist", "generated");

async function copyGeneratedDts(): Promise<void> {
    let entries: string[];
    try {
        entries = await readdir(generatedSrc);
    } catch {
        return;
    }
    await mkdir(generatedDist, { recursive: true });
    for (const entry of entries) {
        if (!entry.endsWith(".d.ts")) continue;
        await copyFile(join(generatedSrc, entry), join(generatedDist, entry));
    }
}

await copyGeneratedDts();
