import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { distTagForVersion, type PackageManifest } from "./publish-manifest.ts";
import { releasePackageNames } from "./release-package-set.ts";

const packageName = (directory: string): string => {
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as PackageManifest;

    if (typeof manifest.name !== "string") {
        throw new TypeError(`Release package has no name: ${directory}`);
    }

    return manifest.name;
};

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "packages", "create-gtkx", "package.json");
const release = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
const version = process.argv[2] ?? release.version;

if (typeof version !== "string" || version.length === 0) {
    throw new Error("Release channel verification requires an exact version");
}

const requested = process.argv.slice(3);
const names = requested.length === 0 ? releasePackageNames() : requested.map((directory) => packageName(directory));
const tag = distTagForVersion(version);
const registry = new URL(process.env.NPM_CONFIG_REGISTRY ?? "https://registry.npmjs.org/");

for (const name of names) {
    const response = await fetch(new URL(encodeURIComponent(name), registry), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw new Error(`Release channel verification failed: HTTP ${String(response.status)}`);
    }

    const document = await response.json() as {
        "dist-tags"?: Record<string, string>;
        versions?: Record<string, unknown>;
    };

    if (document["dist-tags"]?.[tag] !== version || document.versions?.[version] === undefined) {
        throw new Error(`Release channel no longer identifies ${name}@${version}`);
    }
}
