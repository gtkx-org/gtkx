import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packageManagers } from "nypm";
import { manifestPath } from "./manifest.js";
import type { Workspace } from "./workspace.js";

type FileSnapshot = {
    restore: () => string[];
};

const SETTINGS_FILES: readonly string[] = ["pnpm-workspace.yaml", ".yarnrc.yml", ".npmrc"];
const LOCKFILES: readonly string[] = packageManagers.flatMap(({ lockFile }) => lockFile ?? []);

const readContents = (path: string): Buffer | null => (existsSync(path) ? readFileSync(path) : null);

const isUnchanged = (path: string, contents: Buffer | null): boolean => {
    const current = readContents(path);

    return current === null || contents === null ? current === contents : current.equals(contents);
};

/**
 * Records the files an upgrade can change: every member's `package.json`, and the package manager settings
 * and lockfiles at the workspace root. `restore` puts back each one that changed since, deleting the ones
 * that did not exist, and returns their paths.
 */
const snapshotUpgradeFiles = (workspace: Workspace): FileSnapshot => {
    const paths = [
        ...workspace.members.map(manifestPath),
        ...[...SETTINGS_FILES, ...LOCKFILES].map((name) => join(workspace.root, name)),
    ];
    const recorded = new Map(paths.map((path) => [path, readContents(path)]));

    return {
        restore: () =>
            [...recorded].flatMap(([path, contents]) => {
                if (isUnchanged(path, contents)) {
                    return [];
                }

                if (contents === null) {
                    rmSync(path, { force: true });
                } else {
                    writeFileSync(path, contents);
                }

                return [path];
            }),
    };
};

export { snapshotUpgradeFiles };
