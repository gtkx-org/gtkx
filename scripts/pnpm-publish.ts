import { resolveExecutable } from "@gtkx/utils";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { PackageManifest } from "./publish-manifest.js";

const ALREADY_PUBLISHED = /cannot publish over|EPUBLISHCONFLICT|previously published version/i;
const VISIBILITY_TIMEOUT_MS = 120_000;
const VISIBILITY_INTERVAL_MS = 1000;
const REGISTRY_REQUEST_TIMEOUT_MS = 10_000;
const EMPTY_CONFIG_VALUES = new Set(["", "undefined", "null"]);

const runPnpmPublish = (packageDir: string, tag: string): SpawnSyncReturns<string> => {
    const provenance = process.env.NPM_CONFIG_PROVENANCE === "true" ? ["--provenance"] : [];
    const args = ["publish", "--access", "public", "--no-git-checks", ...provenance, "--tag", tag];

    return spawnSync(resolveExecutable("pnpm"), args, {
        cwd: packageDir,
        stdio: ["inherit", "pipe", "pipe"],
        encoding: "utf8",
    });
};

const assertPublishOutcome = (packageDir: string, result: SpawnSyncReturns<string>, output: string): void => {
    if (result.status === 0) {
        return;
    }

    if (ALREADY_PUBLISHED.test(output)) {
        console.log(`${packageDir} is already published, skipping`);

        return;
    }

    throw new Error(`pnpm publish failed with exit code ${String(result.status ?? "unknown")}`);
};

const packageIdentity = (packageDir: string): { name: string; version: string; manifest: PackageManifest } => {
    const manifestPath = join(packageDir, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

    if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
        throw new TypeError(`Published package has no name or version in ${manifestPath}`);
    }

    return { name: manifest.name, version: manifest.version, manifest };
};

const manifestRegistry = (manifest: PackageManifest): string | undefined => {
    const publishConfig = manifest.publishConfig;

    if (publishConfig === null || typeof publishConfig !== "object" || Array.isArray(publishConfig)) {
        return undefined;
    }

    const registry: unknown = Reflect.get(publishConfig, "registry");

    return typeof registry === "string" && registry.length > 0 ? registry : undefined;
};

const registryConfigKeys = (name: string): string[] => {
    const slash = name.indexOf("/");

    return name.startsWith("@") && slash > 0 ? [`${name.slice(0, slash)}:registry`, "registry"] : ["registry"];
};

const readRegistryConfig = (packageDir: string, key: string): string | undefined => {
    const result = spawnSync(resolveExecutable("pnpm"), ["config", "get", key], {
        cwd: packageDir,
        encoding: "utf8",
    });

    if (result.error) {
        throw result.error;
    }

    const value = result.status === 0 ? result.stdout.trim() : "";

    return EMPTY_CONFIG_VALUES.has(value) ? undefined : value;
};

const configRegistry = (packageDir: string, name: string): string => {
    for (const key of registryConfigKeys(name)) {
        const value = readRegistryConfig(packageDir, key);

        if (value !== undefined) {
            return value;
        }
    }

    throw new Error(`Could not resolve the registry for ${name}`);
};

const registryFor = (packageDir: string, name: string, manifest: PackageManifest): URL => {
    const configured = manifestRegistry(manifest) ?? configRegistry(packageDir, name);
    const normalized = configured.endsWith("/") ? configured : `${configured}/`;

    return new URL(normalized);
};

const registryDocument = async (url: URL): Promise<object | undefined> => {
    try {
        const response = await fetch(url, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
            signal: AbortSignal.timeout(REGISTRY_REQUEST_TIMEOUT_MS),
        });

        const body: unknown = response.ok ? await response.json() : undefined;

        return body !== null && typeof body === "object" ? body : undefined;
    } catch {
        return undefined;
    }
};

const field = (value: unknown, key: string): unknown =>
    value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;

const isVersionVisible = (document: unknown, version: string): boolean => field(document, "version") === version;

const isTagVisible = (document: unknown, tag: string, version: string): boolean => {
    const tags = field(document, "dist-tags");

    return tags !== null && typeof tags === "object" && Reflect.get(tags, tag) === version;
};

const waitForVisibility = async (packageDir: string, tag: string): Promise<void> => {
    const { name, version, manifest } = packageIdentity(packageDir);
    const registry = registryFor(packageDir, name, manifest);
    const encodedName = encodeURIComponent(name);
    const versionUrl = new URL(`${encodedName}/${encodeURIComponent(version)}`, registry);
    const packumentUrl = new URL(encodedName, registry);
    const deadline = Date.now() + VISIBILITY_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const [versionDocument, packument] = await Promise.all([
            registryDocument(versionUrl),
            registryDocument(packumentUrl),
        ]);

        if (isVersionVisible(versionDocument, version) && isTagVisible(packument, tag, version)) {
            console.log(`${name}@${version} is visible on the registry with dist-tag ${tag}`);

            return;
        }

        await delay(VISIBILITY_INTERVAL_MS);
    }

    throw new Error(`${name}@${version} did not become visible with dist-tag ${tag} within 120 seconds`);
};

const publishPackage = async (packageDir: string, tag: string): Promise<void> => {
    const result = runPnpmPublish(packageDir, tag);
    const { stdout, stderr } = result;
    process.stdout.write(stdout);
    process.stderr.write(stderr);

    if (result.error) {
        throw result.error;
    }

    assertPublishOutcome(packageDir, result, `${stdout}${stderr}`);
    await waitForVisibility(packageDir, tag);
};

export { publishPackage };
