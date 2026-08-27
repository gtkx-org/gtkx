import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    PACKAGES_DIR,
    REGISTRY,
    type RegistryContext,
    runAsync,
    verifyBuiltAppStarts,
    withRegistry,
} from "./e2e-registry.js";
import { assertPublishedShape, type PackageManifest } from "./publish-manifest.js";

type ConsumerVariant = { appName: string; applicationId: string; isTypescript: boolean };

type Packument = {
    "dist-tags": { latest?: string };
    versions: Record<string, { dist: { tarball: string } }>;
};

const CONSUMER_VARIANTS: ConsumerVariant[] = [
    { appName: "release-e2e-ts", applicationId: "com.gtkx.release-e2e-ts", isTypescript: true },
    { appName: "release-e2e-js", applicationId: "com.gtkx.release-e2e-js", isTypescript: false },
];

function runCapture(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args);
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

async function tarballUrl(name: string): Promise<string> {
    const response = await fetch(`${REGISTRY}${name}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch packument for ${name}: HTTP ${String(response.status)}`);
    }

    const packument = (await response.json()) as Packument;
    const latest = packument["dist-tags"].latest;

    if (latest === undefined) {
        throw new Error(`Registry reports no latest version for ${name}`);
    }

    const version = packument.versions[latest];

    if (version === undefined) {
        throw new Error(`Registry is missing the manifest for ${name}@${latest}`);
    }

    return version.dist.tarball;
}

async function inspectTarball(
    name: string,
    inspectDir: string,
): Promise<{ entries: string[]; manifest: PackageManifest; maps: Record<string, string> }> {
    const response = await fetch(await tarballUrl(name));

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

async function verifyPublishedShapes(inspectDir: string): Promise<void> {
    const names = publishablePackageNames();

    for (const name of names) {
        const { entries, manifest, maps } = await inspectTarball(name, inspectDir);
        assertPublishedShape({ name, entries, manifest, maps });
    }

    console.log(`release-e2e: verified the published shape of ${String(names.length)} packages`);
}

async function verifyConsumer(consumerRoot: string, env: NodeJS.ProcessEnv, variant: ConsumerVariant): Promise<void> {
    const language = variant.isTypescript ? "TypeScript" : "JavaScript";

    const scaffoldArgs = [
        "create",
        `gtkx@${createGtkxVersion()}`,
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

    await runAsync("npm", scaffoldArgs, { cwd: consumerRoot, env });
    const appDir = join(consumerRoot, variant.appName);
    await runAsync("npm", ["run", "build"], { cwd: appDir, env });
    await verifyBuiltAppStarts(appDir);

    if (variant.isTypescript) {
        await runAsync("npm", ["run", "typecheck"], { cwd: appDir, env });
    }

    await runAsync("npm", ["test"], { cwd: appDir, env });
    console.log(`release-e2e: ${language} consumer scaffold, build, run, and test succeeded`);
}

async function main(): Promise<void> {
    const consumerRoot = mkdtempSync(join(tmpdir(), "gtkx-consumer-"));
    const staleMapDir = join(PACKAGES_DIR, "cli", "dist");
    const staleMapPath = join(staleMapDir, `release-e2e-stale-${randomUUID()}.d.ts.map`);
    let isStaleMapCreated = false;

    try {
        mkdirSync(staleMapDir, { recursive: true });

        writeFileSync(
            staleMapPath,
            `${JSON.stringify({
                version: 3,
                file: "release-e2e-stale.d.ts",
                sources: ["../src/release-e2e-stale.ts"],
                names: [],
                mappings: "",
            })}\n`,
            { flag: "wx" },
        );

        isStaleMapCreated = true;

        await withRegistry(async ({ env, registryDir }: RegistryContext) => {
            await verifyPublishedShapes(registryDir);

            for (const variant of CONSUMER_VARIANTS) {
                await verifyConsumer(consumerRoot, env, variant);
            }
        });
    } finally {
        if (isStaleMapCreated) {
            rmSync(staleMapPath, { force: true });
        }

        rmSync(consumerRoot, { recursive: true, force: true });
    }
}

await main();
