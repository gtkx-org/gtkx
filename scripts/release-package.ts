import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publishPackage } from "./pnpm-publish.js";
import { distTagForVersion, type PackageManifest, stripDevArtifacts } from "./publish-manifest.js";

const releasePackage = async (): Promise<void> => {
    const packageDir = process.cwd();
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
