import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PackageManager } from "./package-managers.js";

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";
const PACKAGE_JSON_FILE = "package.json";
const SAFE_YAML_KEY = /^[A-Za-z][A-Za-z0-9-]*$/;
const PACKAGES_KEY = /^packages:/m;
const PNPM_PACKAGES_BLOCK = "packages:\n  - '.'\n";

const quoteYamlKey = (name: string): string => (SAFE_YAML_KEY.test(name) ? name : `'${name}'`);
const endWithNewline = (value: string): string => (value.endsWith("\n") ? value : `${value}\n`);

const readIfPresent = (path: string): string => {
    try {
        return readFileSync(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return "";
        }

        throw error;
    }
};

const readManifest = (root: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(root, PACKAGE_JSON_FILE), "utf8")) as Record<string, unknown>;

const writeManifest = (root: string, manifest: Record<string, unknown>): void => {
    writeFileSync(join(root, PACKAGE_JSON_FILE), `${JSON.stringify(manifest, null, 4)}\n`);
};

const writePnpmAllowance = (root: string): void => {
    const path = join(root, PNPM_WORKSPACE_FILE);
    const entries = BUILT_DEPENDENCIES.map((name) => `  ${quoteYamlKey(name)}: true`).join("\n");
    const existing = readIfPresent(path);
    const packages = PACKAGES_KEY.test(existing) ? "" : PNPM_PACKAGES_BLOCK;
    const block = `${packages}allowBuilds:\n${entries}\n`;
    writeFileSync(path, existing.length === 0 ? block : `${endWithNewline(existing)}${block}`);
};

const writeNpmAllowance = (root: string): void => {
    const manifest = readManifest(root);
    manifest.allowScripts = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, true]));
    writeManifest(root, manifest);
};

const writeYarnAllowance = (root: string): void => {
    const manifest = readManifest(root);
    manifest.dependenciesMeta = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, { built: true }]));
    writeManifest(root, manifest);
};

const writeBuildAllowance = (root: string, packageManager: PackageManager): void => {
    if (packageManager === "pnpm") {
        writePnpmAllowance(root);

        return;
    }

    if (packageManager === "yarn") {
        writeYarnAllowance(root);

        return;
    }

    writeNpmAllowance(root);
};

export { writeBuildAllowance, BUILT_DEPENDENCIES };
