import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageManifest } from "./publish-manifest.js";

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));

const nativePlatforms = (nativeDir: string): string[] => {
    const manifest = JSON.parse(readFileSync(join(nativeDir, "package.json"), "utf8")) as {
        napi: { targets: string[] };
    };

    return manifest.napi.targets.map((target) => {
        if (target === "x86_64-unknown-linux-gnu") {
            return "linux-x64-gnu";
        }

        if (target === "aarch64-unknown-linux-gnu") {
            return "linux-arm64-gnu";
        }

        throw new Error(`Unsupported native release target: ${target}`);
    });
};

const workspacePackages = (): { directory: string; name: string }[] => {
    const packagesDir = join(ROOT_DIR, "packages");

    return readdirSync(packagesDir).flatMap((entry) => {
        const directory = join(packagesDir, entry);
        const path = join(directory, "package.json");

        if (!existsSync(path)) {
            return [];
        }

        const manifest = JSON.parse(readFileSync(path, "utf8")) as PackageManifest;

        if (manifest.private === true) {
            return [];
        }

        if (typeof manifest.name !== "string") {
            throw new TypeError(`Release package has no name: ${directory}`);
        }

        return [{ directory, name: manifest.name }];
    });
};

const releasePackages = (): { directory: string; name: string }[] => {
    const packages = workspacePackages();
    const native = packages.find(({ directory }) => directory === join(ROOT_DIR, "packages", "native"));

    if (native === undefined) {
        throw new Error("Release is missing the native package");
    }

    const platforms = nativePlatforms(native.directory).map((platform) => ({
        directory: join(native.directory, "npm", platform),
        name: `${native.name}-${platform}`,
    }));

    return [...platforms, ...packages];
};

const releasePackageDirectories = (): string[] => releasePackages().map(({ directory }) => directory);
const releasePackageNames = (): string[] => releasePackages().map(({ name }) => name);

export { nativePlatforms, releasePackageDirectories, releasePackageNames };
