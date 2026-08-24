import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
    hostNativeTarget,
    PACKAGES_DIR,
    REGISTRY,
    type RegistryContext,
    runAsync,
    verifyAppStarts,
    withRegistry,
} from "./e2e-registry.js";
import { assertPublishedShape, type PackageManifest } from "./publish-manifest.js";

type ConsumerVariant = { appName: string; applicationId: string; isTypescript: boolean };

type MinimumNodeRuntime = {
    env: NodeJS.ProcessEnv;
    nodePath: string;
    npmCliPath: string;
};

type NodeRelease = {
    archiveName: string;
    directoryName: string;
    sha256: string;
};

type Packument = {
    versions: Record<string, { dist: { tarball: string } }>;
};

const CONSUMER_VARIANTS: ConsumerVariant[] = [
    { appName: "release-e2e-ts", applicationId: "com.gtkx.release-e2e-ts", isTypescript: true },
    { appName: "release-e2e-js", applicationId: "com.gtkx.release-e2e-js", isTypescript: false },
];

const STALE_OUTPUT_DIRECTORY = join(PACKAGES_DIR, "cairo", "dist");
const STALE_OUTPUT = join(STALE_OUTPUT_DIRECTORY, `release-e2e-stale-${randomUUID()}.d.ts.map`);
const NATIVE_PACKAGE = "@gtkx/native";
const MINIMUM_NODE_VERSION = "24.11.0";
const PACKAGE_LICENSE = "MPL-2.0";
const NODE_DIST_URL = `https://nodejs.org/dist/v${MINIMUM_NODE_VERSION}`;

const NODE_RELEASE_DIGESTS: Record<string, string> = {
    arm64: "33a6673b2c7bffeae9deec7f9f8b31aad9119b08f13d49b2ca3ee3bebfe8260f",
    x64: "46da9a098973ab7ba4fca76945581ecb2eaf468de347173897044382f10e0a0a",
};

function stageStaleOutput(): void {
    mkdirSync(STALE_OUTPUT_DIRECTORY, { recursive: true });

    if (!lstatSync(STALE_OUTPUT_DIRECTORY).isDirectory()) {
        throw new Error(`Refusing to use non-directory release output ${STALE_OUTPUT_DIRECTORY}`);
    }

    if (lstatSync(STALE_OUTPUT, { throwIfNoEntry: false }) !== undefined) {
        throw new Error(`Refusing to replace existing release fixture ${STALE_OUTPUT}`);
    }

    writeFileSync(
        STALE_OUTPUT,
        JSON.stringify({
            version: 3,
            file: "release-e2e-stale.d.ts",
            sources: ["../src/index.ts"],
            sourcesContent: ["export * from \"./context.js\";"],
            names: [],
            mappings: "",
        }),
        { flag: "wx" },
    );
}

function runCapture(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { env });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString("utf8");
        });

        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
        });

        child.on("error", reject);

        child.on("close", (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(
                    new Error(
                        `Command failed with exit code ${String(code ?? "unknown")}: ` +
                        `${command} ${args.join(" ")}\n${stderr}`,
                    ),
                );
            }
        });
    });
}

function minimumNodeRelease(): NodeRelease {
    const sha256 = NODE_RELEASE_DIGESTS[process.arch];

    if (sha256 === undefined) {
        throw new Error(`Node.js ${MINIMUM_NODE_VERSION} has no pinned Linux build for ${process.arch}`);
    }

    const directoryName = `node-v${MINIMUM_NODE_VERSION}-linux-${process.arch}`;

    return { archiveName: `${directoryName}.tar.xz`, directoryName, sha256 };
}

async function fetchMinimumNodeArchive(release: NodeRelease): Promise<Buffer> {
    const response = await fetch(`${NODE_DIST_URL}/${release.archiveName}`);

    if (!response.ok) {
        throw new Error(
            `Failed to download Node.js ${MINIMUM_NODE_VERSION}: HTTP ${String(response.status)}`,
        );
    }

    const archive = Buffer.from(await response.arrayBuffer());
    const digest = createHash("sha256").update(archive).digest("hex");

    if (digest !== release.sha256) {
        throw new Error(`Node.js ${MINIMUM_NODE_VERSION} archive failed checksum verification`);
    }

    return archive;
}

function assertMinimumNodePaths(nodePath: string, npmCliPath: string): void {
    if (!existsSync(nodePath) || !existsSync(npmCliPath)) {
        throw new Error(`Node.js ${MINIMUM_NODE_VERSION} archive is missing its runtime or npm CLI`);
    }
}

function minimumNodeEnv(env: NodeJS.ProcessEnv, binDir: string): NodeJS.ProcessEnv {
    const inheritedPath = env.PATH;

    const path =
        inheritedPath === undefined || inheritedPath.length === 0
            ? binDir
            : `${binDir}${delimiter}${inheritedPath}`;

    return { ...env, NPM_CONFIG_ENGINE_STRICT: "true", PATH: path };
}

async function downloadMinimumNode(root: string, env: NodeJS.ProcessEnv): Promise<MinimumNodeRuntime> {
    const release = minimumNodeRelease();
    const archive = await fetchMinimumNodeArchive(release);
    const archivePath = join(root, release.archiveName);
    writeFileSync(archivePath, archive);
    await runAsync("tar", ["-xJf", archivePath, "-C", root], {});
    rmSync(archivePath, { force: true });
    const distributionDir = join(root, release.directoryName);
    const nodePath = join(distributionDir, "bin", "node");
    const npmCliPath = join(distributionDir, "lib", "node_modules", "npm", "bin", "npm-cli.js");
    assertMinimumNodePaths(nodePath, npmCliPath);
    const runtimeEnv = minimumNodeEnv(env, join(distributionDir, "bin"));
    const versionOutput = await runCapture(nodePath, ["--version"], runtimeEnv);
    const reportedVersion = versionOutput.trim();

    if (reportedVersion !== `v${MINIMUM_NODE_VERSION}`) {
        throw new Error(`Expected Node.js ${MINIMUM_NODE_VERSION}, received ${reportedVersion}`);
    }

    return { env: runtimeEnv, nodePath, npmCliPath };
}

function createGtkxVersion(): string {
    const manifestPath = join(PACKAGES_DIR, "create-gtkx", "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

    if (typeof manifest.version !== "string") {
        throw new TypeError(`create-gtkx has no version in ${manifestPath}`);
    }

    return manifest.version;
}

function publishableName(entry: string): string | undefined {
    const manifestPath = join(PACKAGES_DIR, entry, "package.json");

    if (!existsSync(manifestPath)) {
        return undefined;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

    if (manifest.private === true) {
        return undefined;
    }

    return typeof manifest.name === "string" ? manifest.name : undefined;
}

function publishablePackageNames(): string[] {
    return readdirSync(PACKAGES_DIR)
        .map((entry) => publishableName(entry))
        .filter((name): name is string => name !== undefined);
}

async function tarballUrl(name: string, releaseVersion: string): Promise<string> {
    const response = await fetch(`${REGISTRY}${name}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch packument for ${name}: HTTP ${String(response.status)}`);
    }

    const packument = (await response.json()) as Packument;
    const version = packument.versions[releaseVersion];

    if (version === undefined) {
        throw new Error(`Registry is missing the manifest for ${name}@${releaseVersion}`);
    }

    return version.dist.tarball;
}

async function inspectTarball(
    name: string,
    inspectDir: string,
    releaseVersion: string,
): Promise<{ entries: string[]; manifest: PackageManifest; maps: Record<string, string> }> {
    const response = await fetch(await tarballUrl(name, releaseVersion));

    if (!response.ok) {
        throw new Error(`Failed to download the tarball for ${name}: HTTP ${String(response.status)}`);
    }

    const tarballPath = join(inspectDir, "package.tgz");
    writeFileSync(tarballPath, Buffer.from(await response.arrayBuffer()));
    const listing = await runCapture("tar", ["-tzf", tarballPath]);

    const entries = listing
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const manifest = JSON.parse(
        await runCapture("tar", ["-xzOf", tarballPath, "package/package.json"]),
    ) as PackageManifest;

    const maps: Record<string, string> = {};
    const mapEntries = entries.filter((entry) => entry.endsWith(".map"));

    if (mapEntries.length > 0) {
        await runAsync("tar", ["-xzf", tarballPath, "-C", inspectDir, ...mapEntries], {});

        for (const entry of mapEntries) {
            maps[entry] = readFileSync(join(inspectDir, entry), "utf8");
        }
    }

    return { entries, manifest, maps };
}

function assertReleaseMetadata(name: string, manifest: PackageManifest, releaseVersion: string): void {
    if (
        manifest.version !== releaseVersion ||
        manifest.license !== PACKAGE_LICENSE ||
        manifest.engines?.node !== `>=${MINIMUM_NODE_VERSION}`
    ) {
        throw new TypeError(`Published ${name} has metadata inconsistent with release ${releaseVersion}`);
    }
}

async function verifyPublishedPackage(
    name: string,
    inspectDir: string,
    releaseVersion: string,
): Promise<PackageManifest> {
    const { entries, manifest, maps } = await inspectTarball(name, inspectDir, releaseVersion);
    assertPublishedShape({ name, entries, manifest, maps });
    assertReleaseMetadata(name, manifest, releaseVersion);

    return manifest;
}

const nativePlatformDependencies = (manifest: PackageManifest | undefined): [string, string][] => {
    const dependencies = Object.entries(manifest?.optionalDependencies ?? {});
    const host = hostNativeTarget();

    if (dependencies.length !== 1 || dependencies[0]?.[0] !== host.platformPackage) {
        throw new Error(`Published ${NATIVE_PACKAGE} does not declare only the host platform package`);
    }

    return dependencies;
};

const isOnlyValue = (values: string[] | undefined, expected: string): boolean =>
    values?.length === 1 && values[0] === expected;

async function verifyNativePlatform(
    options: {
        name: string;
        requiredVersion: string;
        nativeVersion: string;
        inspectDir: string;
        releaseVersion: string;
    },
): Promise<void> {
    const { name, requiredVersion, nativeVersion, inspectDir, releaseVersion } = options;
    const manifest = await verifyPublishedPackage(name, inspectDir, releaseVersion);
    const host = hostNativeTarget();

    if (
        name !== host.platformPackage ||
        manifest.version !== requiredVersion ||
        manifest.version !== nativeVersion ||
        manifest.main !== host.binary ||
        !isOnlyValue(manifest.cpu, host.cpu) ||
        !isOnlyValue(manifest.os, "linux") ||
        !isOnlyValue(manifest.libc, "glibc")
    ) {
        throw new TypeError(`Published ${name} has metadata inconsistent with ${NATIVE_PACKAGE}`);
    }
}

async function verifyPublishedShapes(inspectDir: string, releaseVersion: string): Promise<void> {
    const names = publishablePackageNames();
    const verifiedNames: Set<string> = new Set();
    let nativeManifest: PackageManifest | undefined;

    for (const name of names) {
        const manifest = await verifyPublishedPackage(name, inspectDir, releaseVersion);
        verifiedNames.add(name);
        nativeManifest = name === NATIVE_PACKAGE ? manifest : nativeManifest;
    }

    const nativeVersion = nativeManifest?.version;

    if (typeof nativeVersion !== "string") {
        throw new TypeError(`Published ${NATIVE_PACKAGE} has no version`);
    }

    for (const [name, version] of nativePlatformDependencies(nativeManifest)) {
        await verifyNativePlatform({
            name,
            requiredVersion: version,
            nativeVersion,
            inspectDir,
            releaseVersion,
        });

        verifiedNames.add(name);
    }

    console.log(`release-e2e: verified the published shape of ${String(verifiedNames.size)} packages`);
}

async function runMinimumNpm(
    runtime: MinimumNodeRuntime,
    args: string[],
    cwd: string,
): Promise<void> {
    await runAsync(runtime.nodePath, [runtime.npmCliPath, ...args], { cwd, env: runtime.env });
}

async function verifyConsumer(
    consumerRoot: string,
    runtime: MinimumNodeRuntime,
    variant: ConsumerVariant,
    releaseVersion: string,
): Promise<void> {
    const language = variant.isTypescript ? "TypeScript" : "JavaScript";

    const scaffoldArgs = [
        "create",
        `gtkx@${releaseVersion}`,
        variant.appName,
        "--",
        "--application-id",
        variant.applicationId,
        "--package-manager",
        "npm",
        "--vitest",
    ];

    if (!variant.isTypescript) {
        scaffoldArgs.push("--no-typescript");
    }

    await runMinimumNpm(runtime, scaffoldArgs, consumerRoot);
    const appDir = join(consumerRoot, variant.appName);
    await runMinimumNpm(runtime, ["run", "build"], appDir);
    await verifyAppStarts(appDir, { command: runtime.nodePath, args: ["dist/bundle.mjs"] });

    if (variant.isTypescript) {
        await runMinimumNpm(runtime, ["run", "typecheck"], appDir);
    }

    await runMinimumNpm(runtime, ["test"], appDir);

    console.log(
        `release-e2e: ${language} consumer scaffold, build, run, and test succeeded on ` +
        `Node.js ${MINIMUM_NODE_VERSION}`,
    );
}

async function main(): Promise<void> {
    const consumerRoot = mkdtempSync(join(tmpdir(), "gtkx-consumer-"));
    const releaseVersion = createGtkxVersion();
    let isStaleOutputStaged = false;

    try {
        stageStaleOutput();
        isStaleOutputStaged = true;

        await withRegistry(async ({ env, registryDir }: RegistryContext) => {
            await verifyPublishedShapes(registryDir, releaseVersion);
            const runtime = await downloadMinimumNode(consumerRoot, env);

            for (const variant of CONSUMER_VARIANTS) {
                await verifyConsumer(consumerRoot, runtime, variant, releaseVersion);
            }
        });
    } finally {
        if (isStaleOutputStaged) {
            rmSync(STALE_OUTPUT, { force: true });
        }

        rmSync(consumerRoot, { recursive: true, force: true });
    }
}

await main();
