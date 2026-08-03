import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PackageManager } from "./package-managers.js";

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";
const PACKAGE_JSON_FILE = "package.json";
const SAFE_YAML_KEY = /^[A-Za-z][A-Za-z0-9-]*$/;
const PNPM_PACKAGES_BLOCK = "packages:\n  - '.'\n";

const quoteYamlKey = (name: string): string => (SAFE_YAML_KEY.test(name) ? name : `'${name}'`);

const readManifest = (root: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(root, PACKAGE_JSON_FILE), "utf8")) as Record<string, unknown>;

const writeManifest = (root: string, manifest: Record<string, unknown>): void => {
    writeFileSync(join(root, PACKAGE_JSON_FILE), `${JSON.stringify(manifest, null, 4)}\n`);
};

const writePnpmAllowance = (root: string): void => {
    const entries = BUILT_DEPENDENCIES.map((name) => `  ${quoteYamlKey(name)}: true`).join("\n");
    writeFileSync(join(root, PNPM_WORKSPACE_FILE), `${PNPM_PACKAGES_BLOCK}allowBuilds:\n${entries}\n`);
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
