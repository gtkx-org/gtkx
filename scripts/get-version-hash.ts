#!/usr/bin/env node --conditions=source

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { REPO_ROOT } from "./_utils.js";
import { join } from "node:path";

const packagesDir = join(REPO_ROOT, "packages");

interface PackageVersion {
    name: string;
    version: string;
}

const collectVersions = (): PackageVersion[] => {
    const versions: PackageVersion[] = [];
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifestPath = join(packagesDir, entry.name, "package.json");
        if (!existsSync(manifestPath)) continue;
        const manifest: { name?: string; version?: string } = JSON.parse(readFileSync(manifestPath, "utf8"));
        versions.push({ name: manifest.name ?? entry.name, version: manifest.version ?? "" });
    }
    return versions.sort((left, right) => left.name.localeCompare(right.name));
};

const digest = createHash("sha256").update(JSON.stringify(collectVersions())).digest("hex");

process.stdout.write(`${digest}\n`);
