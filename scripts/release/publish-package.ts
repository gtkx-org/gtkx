import { spawnSync } from "node:child_process";
import { gt, valid } from "semver";
import {
    packageAt,
    registryDocument,
    verifyRelease,
    visibilityTimeoutMs,
    type RegistryPackage,
    type ReleasePackage,
} from "./verify-release.ts";

const resolveRegistry = (entry: ReleasePackage): RegistryPackage => {
    if (entry.registry !== undefined) {
        return { ...entry, registry: entry.registry };
    }

    const scope = entry.name.startsWith("@") ? entry.name.split("/", 1)[0] : undefined;

    for (const key of [...(scope === undefined ? [] : [`${scope}:registry`]), "registry"]) {
        const result = spawnSync("pnpm", ["config", "get", key], { cwd: entry.directory, encoding: "utf8" });

        if (result.error) {
            throw result.error;
        }

        const value = result.status === 0 ? result.stdout.trim() : "";

        if (value !== "" && value !== "undefined" && value !== "null") {
            return { ...entry, registry: new URL(value.endsWith("/") ? value : `${value}/`) };
        }
    }

    throw new Error(`Could not resolve the registry for ${entry.name}`);
};

const assertChannelCanAdvance = (entry: RegistryPackage, current: string | undefined): void => {
    if (valid(entry.version) === null) {
        throw new Error(`Invalid release version for ${entry.name}`);
    }

    if (current !== undefined && (valid(current) === null || gt(current, entry.version))) {
        throw new Error(`Release would move ${entry.name}'s ${entry.tag} channel backwards`);
    }
};

const checkReleaseChannel = async (packages: ReleasePackage[]): Promise<RegistryPackage[]> => {
    const resolved = packages.map(resolveRegistry);

    await Promise.all(
        resolved.map(async (entry) => {
            const document = await registryDocument(entry);
            assertChannelCanAdvance(entry, document?.["dist-tags"]?.[entry.tag]);
        }),
    );

    return resolved;
};

const publishPackage = async (directory: string, timeoutMs = visibilityTimeoutMs()): Promise<void> => {
    const entry = resolveRegistry(packageAt(directory));
    const document = await registryDocument(entry, Math.min(10_000, timeoutMs));
    assertChannelCanAdvance(entry, document?.["dist-tags"]?.[entry.tag]);

    if (document?.versions?.[entry.version] === undefined) {
        const result = spawnSync(
            "pnpm",
            [
                "publish",
                "--access",
                "public",
                "--no-git-checks",
                "--tag",
                entry.tag,
                ...(process.env.NPM_CONFIG_PROVENANCE === "true" ? ["--provenance"] : []),
            ],
            { cwd: directory, stdio: ["inherit", "pipe", "pipe"], encoding: "utf8" },
        );

        if (result.error) {
            throw result.error;
        }

        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);

        if (
            result.status !== 0 &&
            !/cannot publish over|EPUBLISHCONFLICT|previously published version/i.test(
                `${result.stdout}${result.stderr}`,
            )
        ) {
            throw new Error(`pnpm publish failed with exit code ${String(result.status ?? "unknown")}`);
        }
    } else {
        console.log(`${entry.name}@${entry.version} is already published, skipping`);
    }

    await verifyRelease([entry], timeoutMs);
};

if (import.meta.main) {
    await publishPackage(process.cwd());
}

export { checkReleaseChannel, publishPackage };
