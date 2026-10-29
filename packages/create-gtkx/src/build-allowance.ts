import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { PackageManager } from "./package-managers.js";
import { updateManifest } from "./manifest.js";

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";
const YARN_CONFIG_FILE = ".yarnrc.yml";
const writePnpmAllowance = (root: string): void => {
    const workspace = {
        packages: ["."],
        allowBuilds: Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, true])),
    };
    writeFileSync(join(root, PNPM_WORKSPACE_FILE), stringify(workspace));
};

const writeNpmAllowance = (root: string): void => {
    updateManifest(root, (manifest) => {
        manifest.allowScripts = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, true]));
    });
};

const writeYarnAllowance = (root: string): void => {
    writeFileSync(join(root, YARN_CONFIG_FILE), stringify({ nodeLinker: "node-modules" }));
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

const PACKAGE_MANAGER_CONFIG_FILES: Record<PackageManager, string[]> = {
    pnpm: [PNPM_WORKSPACE_FILE],
    yarn: [YARN_CONFIG_FILE],
    npm: [],
};

export { PACKAGE_MANAGER_CONFIG_FILES, writeBuildAllowance };
