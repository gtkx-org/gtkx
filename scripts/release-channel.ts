import { gt, valid } from "semver";
import { packageIdentity, registryFor, visibilityTimeoutMs, waitForVisibility } from "./pnpm-publish.js";
import { distTagForVersion } from "./publish-manifest.js";

type ReleasePackage = {
    directory: string;
    name: string;
    version: string;
    registry: URL;
    tag: string;
};

const releasePackages = (directories: string[]): ReleasePackage[] => {
    const packages = directories.map((directory) => {
        const { name, version, manifest } = packageIdentity(directory);

        if (valid(version) === null) {
            throw new Error(`Invalid release version for ${name}`);
        }

        return {
            directory, name, version, registry: registryFor(directory, name, manifest), tag: distTagForVersion(version),
        };
    });

    if (packages.length === 0 || new Set(packages.map(({ version }) => version)).size !== 1) {
        throw new Error("A release must contain one complete fixed-version package set");
    }

    return packages;
};

const currentChannelVersion = async (entry: ReleasePackage): Promise<unknown> => {
    const response = await fetch(new URL(encodeURIComponent(entry.name), entry.registry), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404) {
        return undefined;
    }

    if (!response.ok) {
        throw new Error(`Cannot inspect release channel: HTTP ${String(response.status)}`);
    }

    const document = await response.json() as { "dist-tags"?: Record<string, unknown> };

    return document["dist-tags"]?.[entry.tag];
};

const assertChannelCanAdvance = async (packages: ReleasePackage[]): Promise<void> => {
    for (const entry of packages) {
        const current = await currentChannelVersion(entry);

        if (current === undefined) {
            continue;
        }

        if (typeof current !== "string" || valid(current) === null || gt(current, entry.version)) {
            throw new Error(`Release would move ${entry.name}'s ${entry.tag} channel backwards`);
        }
    }
};

const checkReleaseChannel = async (directories: string[]): Promise<void> => {
    await assertChannelCanAdvance(releasePackages(directories));
};

const verifyReleaseChannel = async (directories: string[]): Promise<void> => {
    const packages = releasePackages(directories);
    const timeoutMs = visibilityTimeoutMs();
    await assertChannelCanAdvance(packages);

    for (const entry of packages) {
        await waitForVisibility(entry.directory, entry.tag, timeoutMs);
    }
};

export { checkReleaseChannel, verifyReleaseChannel };
