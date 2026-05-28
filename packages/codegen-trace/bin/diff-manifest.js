#!/usr/bin/env node
/**
 * CLI entry point for `gtkx-codegen-diff`.
 *
 * Compares a fresh manifest against a committed golden manifest and prints a
 * readable per-test summary of: matched, added, removed, changed entries.
 * Exits 0 when nothing drifted, 1 when anything did, 2 on usage errors.
 *
 * Usage:
 *   gtkx-codegen-diff --golden <path> --fresh <path>
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";

const parseFlag = (name) => {
    const idx = argv.indexOf(name);
    if (idx === -1 || idx + 1 >= argv.length) return undefined;
    return argv[idx + 1];
};

const goldenPath = parseFlag("--golden");
const freshPath = parseFlag("--fresh");
if (goldenPath === undefined || freshPath === undefined) {
    stderr.write("usage: gtkx-codegen-diff --golden <path> --fresh <path>\n");
    exit(2);
}

const goldenAbs = resolve(goldenPath);
const freshAbs = resolve(freshPath);
if (!existsSync(goldenAbs)) {
    stderr.write(`golden manifest not found: ${goldenAbs}\n`);
    exit(2);
}
if (!existsSync(freshAbs)) {
    stderr.write(`fresh manifest not found: ${freshAbs}\n`);
    exit(2);
}

const golden = JSON.parse(readFileSync(goldenAbs, "utf8"));
const fresh = JSON.parse(readFileSync(freshAbs, "utf8"));

const goldenByFile = new Map(golden.entries.map((e) => [e.testFile, e]));
const freshByFile = new Map(fresh.entries.map((e) => [e.testFile, e]));

const matched = [];
const changed = [];
const removed = [];
const added = [];

for (const [file, g] of goldenByFile) {
    const f = freshByFile.get(file);
    if (f === undefined) {
        removed.push(file);
        continue;
    }
    if (g.sha256 === f.sha256) {
        matched.push(file);
    } else {
        changed.push({ file, goldenShapes: g.shapes, freshShapes: f.shapes, goldenSha: g.sha256, freshSha: f.sha256 });
    }
}
for (const [file] of freshByFile) {
    if (!goldenByFile.has(file)) added.push(file);
}

const total = golden.entries.length;
stdout.write(`matched: ${matched.length}/${total}\n`);

if (removed.length > 0) {
    stdout.write(`\nremoved (${removed.length}):\n`);
    for (const file of removed.sort()) stdout.write(`  - ${file}\n`);
}
if (added.length > 0) {
    stdout.write(`\nadded (${added.length}):\n`);
    for (const file of added.sort()) stdout.write(`  + ${file}\n`);
}
if (changed.length > 0) {
    stdout.write(`\nchanged (${changed.length}):\n`);
    changed.sort((a, b) => (a.file < b.file ? -1 : 1));
    for (const c of changed) {
        const delta = c.freshShapes - c.goldenShapes;
        const deltaStr = delta === 0 ? "same count" : delta > 0 ? `+${delta}` : `${delta}`;
        stdout.write(`  ~ ${c.file} (${c.goldenShapes} → ${c.freshShapes}, ${deltaStr})\n`);
        stdout.write(`      golden: ${c.goldenSha}\n`);
        stdout.write(`      fresh:  ${c.freshSha}\n`);
    }
}

if (removed.length + added.length + changed.length === 0) {
    stdout.write("\nmanifests match: no FFI surface drift\n");
    exit(0);
}
exit(1);
