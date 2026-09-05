import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { publishPackage } from "./pnpm-publish.js";
import { distTagForVersion, type PackageManifest, stripDevArtifacts } from "./publish-manifest.js";

const findRepoRoot = (start: string): string => {
    let dir = start;

    while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
        const parent = dirname(dir);

        if (parent === dir) {
            throw new Error("Could not locate the monorepo root (pnpm-workspace.yaml)");
        }

        dir = parent;
    }

    return dir;
};

const releasePackage = async (): Promise<void> => {
    const packageDir = process.cwd();
    const root = findRepoRoot(packageDir);
    copyFileSync(join(root, "README.md"), join(packageDir, "README.md"));
    const manifestPath = join(packageDir, "package.json");
    const original = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(original) as PackageManifest;
    writeFileSync(manifestPath, `${JSON.stringify(stripDevArtifacts(manifest), null, 4)}\n`);
    const tag = distTagForVersion(manifest.version ?? "");

    try {
        await publishPackage(packageDir, tag);
    } finally {
        writeFileSync(manifestPath, original);
    }
};

await releasePackage();
