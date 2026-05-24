#!/usr/bin/env node
/**
 * Release entry point invoked by `pnpm release` (locally and from the
 * publish workflow). Performs the full sequence required to ship a release:
 *
 * 1. Builds every workspace package.
 * 2. Copies the repository-root `README.md` into every published package
 *    (per-package READMEs are gitignored build artifacts).
 * 3. Stages the napi sub-package directories and copies the prebuilt native
 *    binaries into them so `@gtkx/native-linux-*-gnu` ship the correct
 *    `.node` files.
 * 4. Publishes every package with a pending changeset.
 *
 * A package counts as published when its `package.json` does not set
 * `private: true`. The script fails fast on the first non-zero exit so a
 * partially published release cannot occur.
 */

import { spawnSync } from "node:child_process";
import { copyFile, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const packagesDir = join(repoRoot, "packages");
const readmeSource = join(repoRoot, "README.md");

interface PackageManifest {
    private?: boolean;
}

/**
 * Resolves the absolute paths of every published package directory under
 * `packages/`, excluding any package whose manifest sets `private: true`.
 *
 * @returns The absolute directory paths of all published packages.
 */
async function findPublishedPackageDirs(): Promise<string[]> {
    const entries = await readdir(packagesDir, { withFileTypes: true });
    const published: string[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const packageDir = join(packagesDir, entry.name);
        const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8")) as PackageManifest;

        if (manifest.private !== true) {
            published.push(packageDir);
        }
    }

    return published;
}

/**
 * Copies the root `README.md` into every published package directory so the
 * file ships alongside the package on npm.
 *
 * @returns A promise that resolves once all copies complete.
 */
async function copyReadme(): Promise<void> {
    const publishedDirs = await findPublishedPackageDirs();
    await Promise.all(publishedDirs.map((packageDir) => copyFile(readmeSource, join(packageDir, "README.md"))));
}

/**
 * Runs a command in the repository root, inheriting stdio. Exits the process
 * with the child's status code if the command fails so the release aborts.
 *
 * @param command - The executable to invoke.
 * @param args - The arguments to pass to the command.
 */
function run(command: string, args: string[]): void {
    const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

run("pnpm", ["build"]);
await copyReadme();
run("pnpm", ["--filter", "@gtkx/native", "create-npm-dirs"]);
run("pnpm", ["--filter", "@gtkx/native", "artifacts"]);
run("pnpm", ["exec", "--", "changeset", "publish"]);
