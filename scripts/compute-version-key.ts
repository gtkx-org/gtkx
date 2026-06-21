#!/usr/bin/env node

/**
 * Computes a deterministic Turbo cache-key component from the workspace package
 * versions.
 *
 * Every package manifest under `packages/` is parsed as JSON, its `name` and
 * `version` fields are extracted, the resulting list is sorted by package name
 * for stable ordering, and the serialized list is hashed with SHA-256. Because
 * the key derives from structured fields rather than raw source text, it
 * changes only when a real version changes — never when a file's formatting is
 * reflowed.
 *
 * The hex digest is printed to stdout so the CI `compute-turbo-env` action can
 * forward it as the `VERSION` Turbo cache-key component.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packagesDir = join(repoRoot, "packages");

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
