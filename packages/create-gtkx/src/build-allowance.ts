import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PackageManager } from "./package-managers.js";
import { updateManifest } from "./manifest.js";

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";
const SAFE_YAML_KEY = /^[A-Za-z][A-Za-z0-9-]*$/;
const PNPM_PACKAGES_BLOCK = "packages:\n  - '.'\n";

const quoteYamlKey = (name: string): string => (SAFE_YAML_KEY.test(name) ? name : `'${name}'`);

const writePnpmAllowance = (root: string): void => {
    const entries = BUILT_DEPENDENCIES.map((name) => `  ${quoteYamlKey(name)}: true`).join("\n");
    writeFileSync(join(root, PNPM_WORKSPACE_FILE), `${PNPM_PACKAGES_BLOCK}allowBuilds:\n${entries}\n`);
};

const writeNpmAllowance = (root: string): void => {
    updateManifest(root, (manifest) => {
        manifest.allowScripts = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, true]));
    });
};

const writeYarnAllowance = (root: string): void => {
    updateManifest(root, (manifest) => {
        manifest.dependenciesMeta = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, { built: true }]));
    });
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

export { writeBuildAllowance };
