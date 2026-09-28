import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nativeArtifactHash, verifyNativeArtifacts } from "./native-artifact.js";
import { publishPackage } from "./pnpm-publish.js";
import { distTagForVersion, type PackageManifest } from "./publish-manifest.js";
import { checkReleaseChannel } from "./release-channel.js";
import { nativePlatforms } from "./release-package-set.js";

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

const platforms = nativePlatforms(packageDir);

if (process.env.GTKX_RELEASE_NATIVE_ARTIFACTS === "true") {
    const artifacts = platforms.map((platform) => verifyNativeArtifacts(artifactsDir, platform.split("-", 2)[1] ?? ""));
    const javascript = new Set([
        nativeArtifactHash(join(packageDir, "index.js")),
        ...artifacts.map((artifact) => nativeArtifactHash(artifact.javascript)),
    ]);
    const declarations = new Set([
        nativeArtifactHash(join(packageDir, "index.d.ts")),
        ...artifacts.map((artifact) => nativeArtifactHash(artifact.declarations)),
    ]);

    if (javascript.size !== 1 || declarations.size !== 1) {
        throw new Error("Native release platforms produced different shared bindings");
    }
}

for (const platform of platforms) {
    const platformDir = join(npmDir, platform);
    const binary = `native.${platform}.node`;
    const source = join(artifactsDir, binary);

    if (!existsSync(source)) {
        throw new Error(`Missing native release artifact: ${binary}`);
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
    await checkReleaseChannel([platformDir]);
    await publishPackage(platformDir, tag);
}

manifest.optionalDependencies = optionalDependencies;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
