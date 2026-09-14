import { resolveExecutable } from "@gtkx/utils";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { PackageManifest } from "./publish-manifest.js";

type PublishOutcome = "published" | "already-published";

const ALREADY_PUBLISHED = /cannot publish over|EPUBLISHCONFLICT|previously published version/i;
const DEFAULT_VISIBILITY_TIMEOUT_MS = 600_000;
const VISIBILITY_TIMEOUT_ENV = "GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS";
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const VISIBILITY_INTERVAL_MS = 1000;
const REGISTRY_REQUEST_TIMEOUT_MS = 10_000;
const EMPTY_CONFIG_VALUES = new Set(["", "undefined", "null"]);

const visibilityTimeoutMs = (): number => {
    const configured = process.env[VISIBILITY_TIMEOUT_ENV];

    if (configured === undefined || configured === "") {
        return DEFAULT_VISIBILITY_TIMEOUT_MS;
    }

    if (!POSITIVE_INTEGER.test(configured.trim())) {
        const received = JSON.stringify(configured);

        throw new Error(`${VISIBILITY_TIMEOUT_ENV} must be a positive integer number of milliseconds, got ${received}`);
    }

    return Number(configured.trim());
};

const runPnpmPublish = (packageDir: string, tag: string): SpawnSyncReturns<string> => {
    const provenance = process.env.NPM_CONFIG_PROVENANCE === "true" ? ["--provenance"] : [];
    const args = ["publish", "--access", "public", "--no-git-checks", ...provenance, "--tag", tag];

    return spawnSync(resolveExecutable("pnpm"), args, {
        cwd: packageDir,
        stdio: ["inherit", "pipe", "pipe"],
        encoding: "utf8",
    });
};

const publishOutcome = (packageDir: string, result: SpawnSyncReturns<string>, output: string): PublishOutcome => {
    if (result.status === 0) {
        return "published";
    }

    if (ALREADY_PUBLISHED.test(output)) {
        console.log(`${packageDir} is already published, skipping`);

        return "already-published";
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

const registryDocument = async (url: URL, timeoutMs: number): Promise<object | undefined> => {
    try {
        const response = await fetch(url, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
            signal: AbortSignal.timeout(timeoutMs),
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

const isTagVisible = (document: unknown, tag: string | undefined, version: string): boolean => {
    if (tag === undefined) {
        return true;
    }

    const tags = field(document, "dist-tags");

    return tags !== null && typeof tags === "object" && Reflect.get(tags, tag) === version;
};

const describeExpected = (name: string, version: string, tag: string | undefined): string =>
    tag === undefined ? `${name}@${version}` : `${name}@${version} with dist-tag ${tag}`;

const waitForVisibility = async (packageDir: string, tag: string | undefined, timeoutMs: number): Promise<void> => {
    const { name, version, manifest } = packageIdentity(packageDir);
    const registry = registryFor(packageDir, name, manifest);
    const encodedName = encodeURIComponent(name);
    const versionUrl = new URL(`${encodedName}/${encodeURIComponent(version)}`, registry);
    const packumentUrl = new URL(encodedName, registry);
    const expected = describeExpected(name, version, tag);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const requestTimeout = Math.min(REGISTRY_REQUEST_TIMEOUT_MS, deadline - Date.now());
        const [versionDocument, packument] = await Promise.all([
            registryDocument(versionUrl, requestTimeout),
            registryDocument(packumentUrl, requestTimeout),
        ]);

        if (
            Date.now() < deadline &&
            isVersionVisible(versionDocument, version) &&
            isTagVisible(packument, tag, version)
        ) {
            console.log(`${expected} is visible on the registry`);

            return;
        }

        await delay(Math.min(VISIBILITY_INTERVAL_MS, deadline - Date.now()));
    }

    const limit = `${String(timeoutMs)} ms (${VISIBILITY_TIMEOUT_ENV} overrides the default)`;

    throw new Error(`${expected} did not become visible within ${limit}`);
};

const publishPackage = async (packageDir: string, tag: string): Promise<void> => {
    const timeoutMs = visibilityTimeoutMs();
    const result = runPnpmPublish(packageDir, tag);
    const { stdout, stderr } = result;
    process.stdout.write(stdout);
    process.stderr.write(stderr);

    if (result.error) {
        throw result.error;
    }

    const outcome = publishOutcome(packageDir, result, `${stdout}${stderr}`);
    await waitForVisibility(packageDir, outcome === "published" ? tag : undefined, timeoutMs);
};

export { publishPackage };
