#!/usr/bin/env node
/**
 * CLI entry point for `gtkx-codegen-manifest`.
 *
 * Walks the snapshot directory and writes a sorted manifest of SHA-256
 * digests. Both the snapshot root and the manifest output path default to
 * the conventional layout under `<repo>/.codegen-golden/`.
 *
 * Usage:
 *   gtkx-codegen-manifest [--snapshots <dir>] [--out <path>] [--root <repo>]
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { argv, cwd, exit, stdout } from "node:process";

import { writeManifest } from "../dist/manifest.js";

const parseFlag = (name) => {
    const idx = argv.indexOf(name);
    if (idx === -1 || idx + 1 >= argv.length) return undefined;
    return argv[idx + 1];
};

const repoRoot = resolve(parseFlag("--root") ?? cwd());
const snapshotRoot = resolve(parseFlag("--snapshots") ?? `${repoRoot}/.codegen-golden`);
const outputPath = resolve(parseFlag("--out") ?? `${snapshotRoot}/manifest.json`);

if (!existsSync(snapshotRoot)) {
    stdout.write(`No snapshot directory at ${snapshotRoot}. Did the capture run?\n`);
    exit(1);
}

const manifest = await writeManifest(snapshotRoot, repoRoot, outputPath);
stdout.write(`Wrote ${manifest.entries.length} entries to ${outputPath}\n`);
