import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { PackageManager } from "./package-managers.js";
import { updateManifest } from "./manifest.js";

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";
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
