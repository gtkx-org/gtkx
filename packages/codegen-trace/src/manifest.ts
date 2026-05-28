/**
 * Builds the golden manifest from per-test `.shapes` files.
 *
 * Each `.shapes` file holds the sorted union of distinct FFI call shapes a
 * test exercised, one canonical-JSON shape per line. Because the file bytes
 * are already canonical, `sha256(file)` is exactly the manifest digest.
 */

import { createHash } from "node:crypto";
import { createReadStream, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createInterface } from "node:readline";

/** One row of the manifest: a test file's `.shapes` snapshot and its digest. */
export type ManifestEntry = {
    /** Repo-relative path of the source test file (derived from the snapshot path). */
    readonly testFile: string;
    /** Repo-relative path of the `.shapes` snapshot. */
    readonly snapshotFile: string;
    /** Lower-case hex SHA-256 of the snapshot file's exact bytes. */
    readonly sha256: string;
    /** Number of distinct FFI shapes recorded for the test file. */
    readonly shapes: number;
};

/** Final manifest written to `<outputRoot>/manifest.json`. */
export type Manifest = {
    /** ISO-8601 timestamp the manifest was produced at. */
    readonly generatedAt: string;
    /** Manifest entries sorted by `testFile` for a stable diff. */
    readonly entries: readonly ManifestEntry[];
};

const walk = (root: string): string[] => {
    const out: string[] = [];
    const visit = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            const info = statSync(full);
            if (info.isDirectory()) visit(full);
            else if (info.isFile() && full.endsWith(".shapes")) out.push(full);
        }
    };
    visit(root);
    return out;
};

/**
 * Derives the test file path the snapshot belongs to from the snapshot path
 * itself: the `.shapes` extension is stripped and the directory layout
 * mirrors the test file's repo-relative path.
 */
const testFileFor = (snapshotFile: string, repoRoot: string, snapshotRoot: string): string => {
    const relSnapshot = relative(snapshotRoot, snapshotFile);
    const trimmed = relSnapshot.endsWith(".shapes") ? relSnapshot.slice(0, -".shapes".length) : relSnapshot;
    return relative(repoRoot, join(repoRoot, trimmed));
};

const digestAndCount = async (path: string): Promise<{ sha256: string; shapes: number }> => {
    const hash = createHash("sha256");
    await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(path);
        stream.on("data", (chunk: string | Buffer) => hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
        stream.on("end", () => resolve());
        stream.on("error", reject);
    });
    let shapes = 0;
    const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of rl) {
        if (line.length > 0) shapes++;
    }
    return { sha256: hash.digest("hex"), shapes };
};

/**
 * Builds the manifest from a directory of `.shapes` snapshot files.
 *
 * @param snapshotRoot - Directory containing the per-test `.shapes` snapshots.
 * @param repoRoot - Root the manifest should report paths relative to.
 */
export async function buildManifest(snapshotRoot: string, repoRoot: string): Promise<Manifest> {
    const files = walk(snapshotRoot).sort();
    const entries: ManifestEntry[] = [];
    for (const snapshotFile of files) {
        const { sha256, shapes } = await digestAndCount(snapshotFile);
        entries.push({
            testFile: testFileFor(snapshotFile, repoRoot, snapshotRoot),
            snapshotFile: relative(repoRoot, snapshotFile),
            sha256,
            shapes,
        });
    }
    entries.sort((a, b) => (a.testFile < b.testFile ? -1 : a.testFile > b.testFile ? 1 : 0));
    return { generatedAt: new Date().toISOString(), entries };
}

/**
 * Convenience helper that builds a manifest and writes it to disk.
 *
 * @param snapshotRoot - Directory containing the per-test `.shapes` snapshots.
 * @param repoRoot - Root the manifest should report paths relative to.
 * @param outputPath - Where to write the resulting `manifest.json`.
 * @returns The manifest that was written.
 */
export async function writeManifest(snapshotRoot: string, repoRoot: string, outputPath: string): Promise<Manifest> {
    const manifest = await buildManifest(snapshotRoot, repoRoot);
    writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
}
