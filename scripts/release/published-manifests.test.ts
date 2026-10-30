import { execFileSync } from "node:child_process";
import { existsSync, mkdtempDisposableSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inc, satisfies, type ReleaseType } from "semver";
import { beforeAll, expect, test } from "vitest";

type Manifest = {
    name: string;
    version: string;
    private?: boolean;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const PACKAGES = join(import.meta.dirname, "../../packages");

const readManifest = (path: string): Manifest => JSON.parse(readFileSync(path, "utf8")) as Manifest;

const pack = (directory: string, destination: string): Manifest => {
    const { filename } = JSON.parse(
        execFileSync("pnpm", ["pack", "--json", "--pack-destination", destination], {
            cwd: directory,
            encoding: "utf8",
        }),
    ) as { filename: string };

    return JSON.parse(
        execFileSync("tar", ["-xzOf", filename, "package/package.json"], { encoding: "utf8" }),
    ) as Manifest;
};

let published = new Map<string, Manifest>();

beforeAll(() => {
    using destination = mkdtempDisposableSync(join(tmpdir(), "gtkx-published-manifests-"));
    const directories = readdirSync(PACKAGES)
        .map((entry) => join(PACKAGES, entry))
        .filter((directory) => existsSync(join(directory, "package.json")))
        .filter((directory) => readManifest(join(directory, "package.json")).private !== true);

    published = new Map(
        directories.map((directory) => {
            const manifest = pack(directory, destination.path);
            return [manifest.name, manifest];
        }),
    );
});

const siblingRanges = (manifest: Manifest): [string, string][] =>
    [...Object.entries(manifest.dependencies ?? {}), ...Object.entries(manifest.peerDependencies ?? {})].filter(
        ([name]) => published.has(name),
    );

const releaseAfter = (version: string, type: ReleaseType): string => {
    const next = inc(version, type);

    if (next === null) {
        throw new Error(`Cannot increment ${version}`);
    }

    return next;
};

const laterReleases = (version: string): string[] => {
    const patch = releaseAfter(version, "patch");

    return [
        version,
        releaseAfter(version, "prerelease"),
        patch,
        releaseAfter(patch, "patch"),
        releaseAfter(patch, "minor"),
    ];
};

test("published packages accept later GTKX releases of the same major only", () => {
    const mismatched = [...published.values()].flatMap((manifest) =>
        siblingRanges(manifest).flatMap(([name, range]) => [
            ...laterReleases(manifest.version)
                .filter((version) => !satisfies(version, range))
                .map((version) => `${manifest.name} -> ${name}@${range} rejects ${version}`),
            ...[releaseAfter(releaseAfter(manifest.version, "patch"), "major")]
                .filter((version) => satisfies(version, range))
                .map((version) => `${manifest.name} -> ${name}@${range} accepts ${version}`),
        ]),
    );

    expect(mismatched).toEqual([]);
});

test("published packages forward the peers their GTKX dependencies require", () => {
    const missing = [...published.values()].flatMap((manifest) =>
        Object.keys(manifest.dependencies ?? {}).flatMap((dependency) => {
            const required = published.get(dependency);

            if (required === undefined) {
                return [];
            }

            return Object.keys(required.peerDependencies ?? {})
                .filter((peer) => required.peerDependenciesMeta?.[peer]?.optional !== true)
                .filter((peer) => manifest.dependencies?.[peer] === undefined)
                .filter((peer) => manifest.peerDependencies?.[peer] === undefined)
                .map((peer) => `${manifest.name} -> ${dependency} needs ${peer}`);
        }),
    );

    expect(missing).toEqual([]);
});
