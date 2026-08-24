import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publishPackage } from "./pnpm-publish.js";
import { distTagForVersion, type PackageManifest } from "./publish-manifest.js";

type NativePackageManifest = PackageManifest & {
    napi?: {
        binaryName?: unknown;
        targets?: unknown;
    };
};

type PlatformRelease = {
    directory: string;
    licensePath: string;
    name: string;
    originalLicense: string | undefined;
    version: string;
};

type NativeTarget = {
    cpu: string;
    libc: string;
    os: string;
    platform: string;
};

type NativeConfig = {
    binaryName: string;
    targets: NativeTarget[];
};

const packageDir = process.cwd();
const manifestPath = join(packageDir, "package.json");
const manifestStats = lstatSync(manifestPath);

if (!manifestStats.isFile() || manifestStats.size === 0) {
    throw new TypeError(`Native package manifest is empty or not a regular file: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as NativePackageManifest;
const manifestMode = manifestStats.mode & 0o7777;
const tag = distTagForVersion(manifest.version ?? "");
const npmDir = join(packageDir, "npm");
const artifactsDir = join(packageDir, "artifacts");

const NATIVE_TARGETS: Record<string, NativeTarget> = {
    "aarch64-unknown-linux-gnu": {
        cpu: "arm64",
        libc: "glibc",
        os: "linux",
        platform: "linux-arm64-gnu",
    },
    "x86_64-unknown-linux-gnu": {
        cpu: "x64",
        libc: "glibc",
        os: "linux",
        platform: "linux-x64-gnu",
    },
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0;

const nativeConfig = (): NativeConfig => {
    const config = manifest.napi;

    if (
        config === undefined ||
        !isNonEmptyString(config.binaryName) ||
        !Array.isArray(config.targets) ||
        config.targets.length === 0 ||
        !config.targets.every(isNonEmptyString)
    ) {
        throw new TypeError("The native package must declare a binary name and at least one target");
    }

    const targets = config.targets.map((triple) => NATIVE_TARGETS[triple]);

    if (targets.includes(undefined)) {
        throw new TypeError("The native package declares an unsupported release target");
    }

    const resolved = targets.filter((target): target is NativeTarget => target !== undefined);

    if (new Set(resolved.map((target) => target.platform)).size !== resolved.length) {
        throw new TypeError("The native package declares duplicate release targets");
    }

    return { binaryName: config.binaryName, targets: resolved };
};

const readReleaseFile = (path: string): Buffer => {
    const stats = lstatSync(path);

    if (!stats.isFile() || stats.size === 0) {
        throw new TypeError(`Native release file is empty or not a regular file: ${path}`);
    }

    return readFileSync(path);
};

const assertReleaseDirectory = (path: string): void => {
    if (!lstatSync(path).isDirectory()) {
        throw new TypeError(`Native release directory is not a regular directory: ${path}`);
    }
};

const readOptionalReleaseFile = (path: string): string | undefined => {
    const stats = lstatSync(path, { throwIfNoEntry: false });

    if (stats === undefined) {
        return undefined;
    }

    if (!stats.isFile()) {
        throw new TypeError(`Native release file is not a regular file: ${path}`);
    }

    return readFileSync(path, "utf8");
};

const replaceManifest = (contents: string): void => {
    const temporary = join(packageDir, `.package.json-${randomUUID()}`);

    try {
        writeFileSync(temporary, contents, { flag: "wx", mode: manifestMode });
        renameSync(temporary, manifestPath);
    } finally {
        rmSync(temporary, { force: true });
    }
};

const isOnlyValue = (values: string[] | undefined, expected: string): boolean =>
    values?.length === 1 && values[0] === expected;

const platformRelease = (binaryName: string, target: NativeTarget): PlatformRelease => {
    const platform = target.platform;
    const artifact = `${binaryName}.${platform}.node`;
    const directory = join(npmDir, platform);
    assertReleaseDirectory(directory);
    const binary = join(directory, artifact);
    const source = readReleaseFile(join(artifactsDir, artifact));
    const packaged = readReleaseFile(binary);
    const manifestPath = join(directory, "package.json");
    const platformManifest = JSON.parse(readReleaseFile(manifestPath).toString("utf8")) as PackageManifest;
    const expectedName = `${manifest.name ?? ""}-${platform}`;

    if (
        !source.equals(packaged) ||
        platform.length === 0 ||
        !isNonEmptyString(platformManifest.name) ||
        platformManifest.name !== expectedName ||
        !isNonEmptyString(platformManifest.version) ||
        platformManifest.version !== manifest.version ||
        platformManifest.main !== artifact ||
        !isOnlyValue(platformManifest.files, artifact) ||
        !isOnlyValue(platformManifest.cpu, target.cpu) ||
        !isOnlyValue(platformManifest.os, target.os) ||
        !isOnlyValue(platformManifest.libc, target.libc) ||
        platformManifest.license !== manifest.license ||
        platformManifest.engines?.node !== manifest.engines?.node
    ) {
        throw new TypeError(`Native platform package ${platform} does not match the root package`);
    }

    readReleaseFile(join(directory, "README.md"));
    const licensePath = join(directory, "LICENSE");

    return {
        directory,
        licensePath,
        name: platformManifest.name,
        originalLicense: readOptionalReleaseFile(licensePath),
        version: platformManifest.version,
    };
};

const platformReleases = (config: NativeConfig): PlatformRelease[] => {
    const { binaryName, targets } = config;
    const prefix = `${binaryName}.`;
    assertReleaseDirectory(artifactsDir);
    assertReleaseDirectory(npmDir);

    const artifacts = readdirSync(artifactsDir, { withFileTypes: true })
        .filter((entry) => entry.name.endsWith(".node"))
        .toSorted((left, right) => left.name.localeCompare(right.name));

    if (
        artifacts.length !== targets.length ||
        artifacts.some((entry) => !entry.isFile() || !entry.name.startsWith(prefix))
    ) {
        throw new TypeError("Native artifacts do not match the configured release targets");
    }

    const artifactNames = new Set(artifacts.map((entry) => entry.name));

    if (targets.some((target) => !artifactNames.has(`${binaryName}.${target.platform}.node`))) {
        throw new TypeError("Native artifacts do not match the configured release targets");
    }

    return targets
        .toSorted((left, right) => left.platform.localeCompare(right.platform))
        .map((target) => platformRelease(binaryName, target));
};

const restoreLicenses = (releases: PlatformRelease[]): void => {
    for (const release of releases) {
        if (release.originalLicense === undefined) {
            rmSync(release.licensePath, { force: true });
        } else {
            writeFileSync(release.licensePath, release.originalLicense);
        }
    }
};

const stageLicenses = (releases: PlatformRelease[], license: string): void => {
    try {
        for (const release of releases) {
            writeFileSync(release.licensePath, license);
        }
    } catch (error) {
        restoreLicenses(releases);
        throw error;
    }
};

const prepublishNative = (): void => {
    const config = nativeConfig();
    const napi = resolveExecutable("napi");
    const optionalDependencies: Record<string, string> = {};
    execFileSync(napi, ["create-npm-dirs"], { cwd: packageDir, stdio: "inherit" });
    execFileSync(napi, ["artifacts"], { cwd: packageDir, stdio: "inherit" });
    const releases = platformReleases(config);
    const license = readFileSync(join(packageDir, "..", "..", "LICENSE"), "utf8");
    stageLicenses(releases, license);

    try {
        for (const release of releases) {
            optionalDependencies[release.name] = release.version;
            publishPackage(release.directory, tag);
        }
    } finally {
        restoreLicenses(releases);
    }

    manifest.optionalDependencies = optionalDependencies;
    replaceManifest(`${JSON.stringify(manifest, null, 4)}\n`);
};

prepublishNative();
