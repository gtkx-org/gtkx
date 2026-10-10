import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publishPackage, visibilityTimeoutMs } from "./pnpm-publish.js";
import { distTagForVersion, type PackageManifest } from "./publish-manifest.js";
import { checkReleaseChannel } from "./release-channel.js";

const releasePackage = async (): Promise<void> => {
    const timeoutMs = visibilityTimeoutMs(process.env.GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS);
    const packageDir = process.cwd();
    const manifestPath = join(packageDir, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
    await checkReleaseChannel([packageDir]);
    const tag = distTagForVersion(manifest.version ?? "");

    await publishPackage(packageDir, tag, timeoutMs);
};

await releasePackage();
