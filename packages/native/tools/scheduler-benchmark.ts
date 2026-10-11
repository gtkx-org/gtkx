/** Runs an isolated lower-bound experiment for copying GLib scheduling policy into JavaScript. */
import { execFileSync } from "node:child_process";
import { mkdtempDisposableSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

type PollDescriptor = { fd: number; events: number };
type Snapshot = { fds: PollDescriptor[]; timeout: number; ready: number };
type Updates = { fds: PollDescriptor[]; delay: number };
type Benchmark = {
    run: (iterations: number, descriptors: number, busy: boolean, policy?: (snapshot: Snapshot) => Updates) => number;
};

const policy = ({ fds, timeout, ready }: Snapshot): Updates => {
    const desired = new Map<number, number>();
    for (const { fd, events } of fds) {
        let mask = 0;
        if (events & 1) mask |= 1;
        if (events & 4) mask |= 2;
        if (events & (8 | 16)) mask |= 4;
        if (events & 2) mask |= 8;
        desired.set(fd, (desired.get(fd) ?? 0) | mask);
    }
    return {
        fds: Array.from(desired, ([fd, events]) => ({ fd, events: events || 4 })),
        delay: ready || timeout === 0 ? 0 : timeout,
    };
};

const median = (samples: number[]): number => {
    const sorted = samples.toSorted((left, right) => left - right);
    const value = sorted[Math.floor(sorted.length / 2)];
    if (value === undefined) throw new Error("The benchmark needs samples");
    return value;
};

using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-scheduler-benchmark-"));
const addon = join(directory.path, "scheduler.node");
const flags = execFileSync("pkg-config", ["--cflags", "--libs", "glib-2.0"], { encoding: "utf8" }).trim().split(/\s+/);
execFileSync("cc", [
    "-std=gnu11",
    "-O3",
    "-shared",
    "-fPIC",
    "-Wall",
    "-Wextra",
    "-Werror",
    `-I${resolve(dirname(process.execPath), "../include/node")}`,
    join(import.meta.dirname, "scheduler-benchmark.c"),
    "-o",
    addon,
    ...flags,
]);
const benchmark = createRequire(import.meta.url)(addon) as Benchmark;
const results = [];
for (const { descriptors, busy } of [
    { descriptors: 0, busy: false },
    { descriptors: 8, busy: false },
    { descriptors: 64, busy: false },
    { descriptors: 8, busy: true },
]) {
    const iterations = busy ? 100 : 10_000;
    benchmark.run(busy ? 5 : 1_000, descriptors, busy, undefined);
    benchmark.run(busy ? 5 : 1_000, descriptors, busy, policy);
    const native: number[] = [];
    const split: number[] = [];
    for (let sample = 0; sample < 5; sample++) {
        if (sample % 2 === 0) {
            native.push(benchmark.run(iterations, descriptors, busy, undefined));
            split.push(benchmark.run(iterations, descriptors, busy, policy));
        } else {
            split.push(benchmark.run(iterations, descriptors, busy, policy));
            native.push(benchmark.run(iterations, descriptors, busy, undefined));
        }
    }
    const nativeUs = median(native);
    const splitUs = median(split);
    results.push({ descriptors, busy, iterations, nativeUs, splitUs, extraUs: splitUs - nativeUs });
}
process.stdout.write(
    `${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, results }, null, 2)}\n`,
);
