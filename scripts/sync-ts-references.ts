#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const WORKSPACE_DIRS = ["packages", "examples"];
const PRIMARY_CONFIGS = ["tsconfig.lib.json", "tsconfig.app.json"];
const TEST_CONFIG = "tsconfig.test.json";
const PRIMARY_FIELDS = ["dependencies", "peerDependencies"];
const TEST_FIELDS = ["dependencies", "peerDependencies", "devDependencies"];

type DependencyFields = Record<string, Record<string, string> | undefined>;

interface WorkspacePackage {
    name: string;
    dir: string;
    manifest: DependencyFields;
    primaryConfig: string | null;
}

interface ManagedConfig {
    file: string;
    fields: string[];
    selfReference: boolean;
}

const toPosix = (value: string): string => value.split("\\").join("/");

const readManifest = (dir: string): (DependencyFields & { name?: string }) | null => {
    const manifestPath = join(dir, "package.json");
    if (!existsSync(manifestPath)) return null;
    return JSON.parse(readFileSync(manifestPath, "utf8"));
};

const discoverPackages = (): Map<string, WorkspacePackage> => {
    const packages = new Map<string, WorkspacePackage>();
    for (const workspace of WORKSPACE_DIRS) {
        const base = join(repoRoot, workspace);
        if (!existsSync(base)) continue;
        for (const entry of readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const dir = join(base, entry.name);
            const manifest = readManifest(dir);
            if (!manifest?.name) continue;
            const primaryConfig = PRIMARY_CONFIGS.find((config) => existsSync(join(dir, config))) ?? null;
            packages.set(manifest.name, { name: manifest.name, dir, manifest, primaryConfig });
        }
    }
    return packages;
};

const workspaceDependencyNames = (
    manifest: DependencyFields,
    fields: string[],
    self: string,
    packages: Map<string, WorkspacePackage>,
): string[] => {
    const names = new Set<string>();
    for (const field of fields) {
        for (const name of Object.keys(manifest[field] ?? {})) {
            if (name !== self && packages.has(name)) names.add(name);
        }
    }
    return [...names];
};

const referencePathsFor = (
    pkg: WorkspacePackage,
    config: ManagedConfig,
    packages: Map<string, WorkspacePackage>,
): string[] => {
    const crossReferences = workspaceDependencyNames(pkg.manifest, config.fields, pkg.name, packages)
        .map((name) => {
            const dependency = packages.get(name);
            if (!dependency?.primaryConfig) return null;
            return `${toPosix(relative(pkg.dir, dependency.dir))}/${dependency.primaryConfig}`;
        })
        .filter((path): path is string => path !== null)
        .sort();

    const selfReferences = config.selfReference && pkg.primaryConfig ? [`./${pkg.primaryConfig}`] : [];
    return [...selfReferences, ...crossReferences];
};

const currentReferencePaths = (config: Record<string, unknown>): string[] => {
    const references = config["references"];
    if (!Array.isArray(references)) return [];
    return references.map((reference: { path?: string }) => reference.path ?? "");
};

const managedConfigsFor = (pkg: WorkspacePackage): ManagedConfig[] => {
    const configs: ManagedConfig[] = [];
    for (const file of PRIMARY_CONFIGS) {
        if (existsSync(join(pkg.dir, file))) configs.push({ file, fields: PRIMARY_FIELDS, selfReference: false });
    }
    if (existsSync(join(pkg.dir, TEST_CONFIG))) {
        configs.push({ file: TEST_CONFIG, fields: TEST_FIELDS, selfReference: true });
    }
    return configs;
};

interface ConfigDrift {
    configPath: string;
    desired: string[];
}

const collectDrift = (packages: Map<string, WorkspacePackage>): ConfigDrift[] => {
    const drift: ConfigDrift[] = [];
    for (const pkg of packages.values()) {
        for (const config of managedConfigsFor(pkg)) {
            const configPath = join(pkg.dir, config.file);
            const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
            const desired = referencePathsFor(pkg, config, packages);
            if (JSON.stringify(currentReferencePaths(parsed)) !== JSON.stringify(desired)) {
                drift.push({ configPath, desired });
            }
        }
    }
    return drift;
};

const applyReferences = ({ configPath, desired }: ConfigDrift): void => {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    if (desired.length > 0) {
        parsed["references"] = desired.map((path) => ({ path }));
    } else {
        delete parsed["references"];
    }
    writeFileSync(configPath, `${JSON.stringify(parsed, null, 4)}\n`);
};

const reportDrift = (drift: ConfigDrift[]): never => {
    const paths = drift.map(({ configPath }) => toPosix(relative(repoRoot, configPath)));
    console.error(`TypeScript project references are out of sync in:\n  ${paths.join("\n  ")}`);
    console.error("Run `pnpm sync:ts-refs` to update them.");
    process.exit(1);
};

const main = (): void => {
    const drift = collectDrift(discoverPackages());

    if (process.argv.includes("--check")) {
        if (drift.length > 0) reportDrift(drift);
        console.log("TypeScript project references are in sync.");
        return;
    }

    if (drift.length === 0) {
        console.log("TypeScript project references already in sync.");
        return;
    }

    const written = drift.map((entry) => {
        applyReferences(entry);
        return entry.configPath;
    });
    const format = spawnSync("pnpm", ["exec", "biome", "format", "--write", ...written], { stdio: "inherit" });
    if (format.status !== 0) process.exit(format.status ?? 1);
    console.log(`Updated TypeScript project references in ${written.length} config(s).`);
};

main();
