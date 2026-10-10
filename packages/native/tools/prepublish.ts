import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { publishPackage } from "../../../scripts/release/publish-package.ts";
import {
    nativePlatforms,
    readManifest,
    visibilityTimeoutMs,
    type PackageManifest,
} from "../../../scripts/release/verify-release.ts";
import { nativeArtifactHash, verifyNativeArtifacts } from "./verify-artifacts.ts";

const { values } = parseArgs({ options: { "from-artifacts": { type: "boolean", default: false } } });
const timeoutMs = visibilityTimeoutMs(process.env.GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS);

const packageDir = process.cwd();
const manifestPath = join(packageDir, "package.json");
const manifest = readManifest(packageDir);
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

execFileSync("napi", ["create-npm-dirs"], { cwd: packageDir, stdio: "inherit" });

const platforms = nativePlatforms(packageDir);

if (values["from-artifacts"]) {
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
    const platformManifest = preparePlatformManifest(readManifest(platformDir));

    if (platformManifest.name !== undefined && platformManifest.version !== undefined) {
        optionalDependencies[platformManifest.name] = platformManifest.version;
    }

    writeFileSync(platformManifestPath, `${JSON.stringify(platformManifest, null, 2)}\n`);
    await publishPackage(platformDir, timeoutMs);
}

manifest.optionalDependencies = optionalDependencies;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
