import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type PackageManifest = {
    name?: string;
    version?: string;
    private?: boolean;
    napi?: { targets: string[] };
    publishConfig?: { registry?: string; [field: string]: unknown };
    [field: string]: unknown;
};

type ReleasePackage = {
    directory: string;
    name: string;
    version: string;
    tag: string;
    registry?: URL;
};

type RegistryPackage = ReleasePackage & { registry: URL };
type RegistryDocument = { "dist-tags"?: Record<string, string>; versions?: Record<string, unknown> };

const ROOT = join(import.meta.dirname, "..");
const NATIVE_PLATFORMS: Record<string, string> = {
    "x86_64-unknown-linux-gnu": "linux-x64-gnu",
    "aarch64-unknown-linux-gnu": "linux-arm64-gnu",
};

const readManifest = (directory: string): PackageManifest =>
    JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as PackageManifest;

const nativePlatforms = (directory: string): string[] => {
    const targets = readManifest(directory).napi?.targets;

    if (targets === undefined) {
        throw new Error(`Native release package has no targets: ${directory}`);
    }

    return targets.map((target) => {
        const platform = NATIVE_PLATFORMS[target];

        if (platform === undefined) {
            throw new Error(`Unsupported native release target: ${target}`);
        }

        return platform;
    });
};

const packageAt = (directory: string, manifest = readManifest(directory)): ReleasePackage => {
    const { name, version } = manifest;

    if (typeof name !== "string" || typeof version !== "string") {
        throw new TypeError(`Release package has no name or version: ${directory}`);
    }

    const core = version.split("+", 1)[0] ?? "";
    const dash = core.indexOf("-");
    const prerelease = dash === -1 ? undefined : core.slice(dash + 1).split(".", 1)[0];
    const tag =
        prerelease === undefined ? "latest" : prerelease === "" || /^\d+$/.test(prerelease) ? "next" : prerelease;
    const configured = manifest.publishConfig?.registry;

    return {
        directory,
        name,
        version,
        tag,
        ...(configured ? { registry: new URL(configured.endsWith("/") ? configured : `${configured}/`) } : {}),
    };
};

const releasePackages = (): ReleasePackage[] => {
    const packages = readdirSync(join(ROOT, "packages")).flatMap((entry) => {
        const directory = join(ROOT, "packages", entry);

        if (!existsSync(join(directory, "package.json"))) {
            return [];
        }

        const manifest = readManifest(directory);

        return manifest.private === true ? [] : [packageAt(directory, manifest)];
    });
    const native = packages.find(({ directory }) => directory === join(ROOT, "packages", "native"));

    if (native === undefined || new Set(packages.map(({ version }) => version)).size !== 1) {
        throw new Error("A release must contain one complete fixed-version package set including native");
    }

    return [
        ...nativePlatforms(native.directory).map((platform) => ({
            ...native,
            name: `${native.name}-${platform}`,
        })),
        ...packages,
    ];
};

const visibilityTimeoutMs = (configured = process.env.GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS): number => {
    if (configured === undefined || configured === "") {
        return 600_000;
    }

    const timeout = Number(configured);

    if (!/^[1-9]\d*$/.test(configured.trim()) || !Number.isSafeInteger(timeout)) {
        throw new Error("GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS must be a positive integer number of milliseconds");
    }

    return timeout;
};

const registryDocument = async (entry: RegistryPackage, timeoutMs = 10_000): Promise<RegistryDocument | undefined> => {
    const response = await fetch(new URL(encodeURIComponent(entry.name), entry.registry), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404) {
        return undefined;
    }

    if (!response.ok) {
        throw new Error(`Cannot inspect ${entry.name}: HTTP ${String(response.status)}`);
    }

    return (await response.json()) as RegistryDocument;
};

const verifyRelease = async (packages: RegistryPackage[], timeoutMs?: number): Promise<void> => {
    const deadline = Date.now() + (timeoutMs ?? 10_000);
    let pending = packages;

    while (pending.length > 0) {
        const results = await Promise.all(
            pending.map(async (entry) => {
                const document = await registryDocument(
                    entry,
                    Math.max(1, Math.min(10_000, deadline - Date.now())),
                ).catch((error: unknown) => {
                    if (timeoutMs === undefined) {
                        throw error;
                    }

                    return undefined;
                });

                return (
                    document?.["dist-tags"]?.[entry.tag] === entry.version &&
                    document.versions?.[entry.version] !== undefined
                );
            }),
        );
        pending = pending.filter((_, index) => results[index] !== true);

        if (pending.length === 0) {
            return;
        }

        if (timeoutMs === undefined || Date.now() >= deadline) {
            const missing = pending.map(({ name, version, tag }) => `${name}@${version} (${tag})`).join(", ");
            const limit = timeoutMs === undefined ? "" : ` within ${String(timeoutMs)} ms`;

            throw new Error(`Release channel does not identify ${missing}${limit}`);
        }

        await delay(Math.min(1000, Math.max(1, deadline - Date.now())));
    }
};

export {
    nativePlatforms,
    packageAt,
    readManifest,
    registryDocument,
    releasePackages,
    verifyRelease,
    visibilityTimeoutMs,
    type PackageManifest,
    type RegistryPackage,
    type ReleasePackage,
};
