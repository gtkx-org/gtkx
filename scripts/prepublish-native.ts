import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publishPackage } from "./pnpm-publish.js";
import { distTagForVersion, type PackageManifest } from "./publish-manifest.js";

const packageDir = process.cwd();
const manifestPath = join(packageDir, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
const tag = distTagForVersion(manifest.version ?? "");
const npmDir = join(packageDir, "npm");
const artifactsDir = join(packageDir, "artifacts");
const optionalDependencies: Record<string, string> = {};

const preparePlatformManifest = (platformManifest: PackageManifest): PackageManifest => {
    const { cpu, libc, os, publishConfig, ...remaining } = platformManifest;
    const configured =
        publishConfig !== null && typeof publishConfig === "object" && !Array.isArray(publishConfig)
            ? publishConfig
            : {};

    return {
        ...remaining,
        publishConfig: {
            ...(cpu !== undefined && { cpu }),
            ...(libc !== undefined && { libc }),
            ...(os !== undefined && { os }),
            ...configured,
        },
    };
};

execFileSync(resolveExecutable("napi"), ["create-npm-dirs"], { cwd: packageDir, stdio: "inherit" });

for (const platform of readdirSync(npmDir)) {
    const platformDir = join(npmDir, platform);
    const binary = `native.${platform}.node`;
    const source = join(artifactsDir, binary);

    if (!existsSync(source)) {
        continue;
    }

    copyFileSync(source, join(platformDir, binary));
    const platformManifestPath = join(platformDir, "package.json");
    const platformManifest = preparePlatformManifest(
        JSON.parse(readFileSync(platformManifestPath, "utf8")) as PackageManifest,
    );

    if (platformManifest.name !== undefined && platformManifest.version !== undefined) {
        optionalDependencies[platformManifest.name] = platformManifest.version;
    }

    writeFileSync(platformManifestPath, `${JSON.stringify(platformManifest, null, 2)}\n`);
    publishPackage(platformDir, tag);
}

manifest.optionalDependencies = optionalDependencies;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
