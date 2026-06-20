#!/usr/bin/env node

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

async function copyReadme(): Promise<void> {
    const publishedDirs = await findPublishedPackageDirs();
    await Promise.all(publishedDirs.map((packageDir) => copyFile(readmeSource, join(packageDir, "README.md"))));
}

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
run("pnpm", ["-r", "publish", "--access", "public", "--no-git-checks"]);
