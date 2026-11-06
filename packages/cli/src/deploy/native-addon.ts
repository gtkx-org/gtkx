import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DeployArchName, DeploySettings } from "./types.js";
import { resolveBinding, resolveNativeManifest } from "../internal/native-binding.js";
import { runCliTool } from "../internal/run-cli-tool.js";
import { cacheDir, downloadFile, readCachedDigest, writeAtomically } from "./download.js";
import { DEFAULT_REGISTRY, publishedTarball, type Tarball } from "./npm-registry.js";
import { isHostArch } from "./settings/arch.js";

const BINDING_FILENAME = "gtkx.node";
const PACKAGE_ROOT = "package";
const STRIP_COMPONENTS = "1";
const VERSION_PATTERN = /^[\w.+-]+$/;

const binaryFilename = (arch: DeployArchName): string => `native.linux-${arch}-gnu.node`;
const platformStem = (arch: DeployArchName): string => `native-linux-${arch}-gnu`;
const platformPackage = (arch: DeployArchName): string => `@gtkx/${platformStem(arch)}`;

const withoutTrailingSlash = (value: string): string => {
    let end = value.length;

    while (end > 0 && value[end - 1] === "/") {
        end -= 1;
    }

    return value.slice(0, end);
};

const registryUrl = (): string => {
    const configured = process.env.npm_config_registry;

    return withoutTrailingSlash(configured !== undefined && configured.length > 0 ? configured : DEFAULT_REGISTRY);
};

const manifestVersion = (manifest: unknown): string | null => {
    if (typeof manifest !== "object" || manifest === null || !("version" in manifest)) {
        return null;
    }

    const version = manifest.version;

    return typeof version === "string" && VERSION_PATTERN.test(version) ? version : null;
};

const nativeVersion = (root: string): string => {
    const parsed: unknown = JSON.parse(readFileSync(resolveNativeManifest(root), "utf8"));
    const version = manifestVersion(parsed);

    if (version === null) {
        throw new Error("Cannot read a usable version from @gtkx/native; is it installed?");
    }

    return version;
};

const platformTarball = (arch: DeployArchName, version: string): Promise<Tarball> =>
    publishedTarball({
        registry: registryUrl(),
        name: platformPackage(arch),
        version,
        remedy: `Install ${platformPackage(arch)}@${version} directly, or drop that architecture from --arch.`,
    });

const extractAddon = (archive: string, dir: string, arch: DeployArchName): void => {
    runCliTool({
        tool: "tar",
        args: [
            "-xzf",
            archive,
            "-C",
            dir,
            "--strip-components",
            STRIP_COMPONENTS,
            `${PACKAGE_ROOT}/${binaryFilename(arch)}`,
        ],
        target: platformPackage(arch),
    });
};

const cachedTarballUrl = (arch: DeployArchName, version: string): string =>
    `${registryUrl()}/${platformPackage(arch)}/-/${platformStem(arch)}-${version}.tgz`;

const tarballFor = async (arch: DeployArchName, version: string, sidecar: string): Promise<Tarball> => {
    const cached = readCachedDigest(sidecar, "sha512");

    if (cached !== undefined) {
        return { url: cachedTarballUrl(arch, version), digest: cached };
    }

    const published = await platformTarball(arch, version);
    writeAtomically(sidecar, published.digest);

    return published;
};

const downloadedBinary = async (arch: DeployArchName, version: string): Promise<string> => {
    const dir = cacheDir(["native", `${version}-linux-${arch}`]);
    const archive = join(dir, `${platformStem(arch)}-${version}.tgz`);
    const tarball = await tarballFor(arch, version, `${archive}.sha512`);

    await downloadFile({
        url: tarball.url,
        dest: archive,
        label: `${platformPackage(arch)} ${version}`,
        digest: tarball.digest,
        algorithm: "sha512",
    });

    extractAddon(archive, dir, arch);

    return join(dir, binaryFilename(arch));
};

const resolveStagedAddon = async (settings: DeploySettings): Promise<string | null> => {
    const arch = settings.arch.node;

    if (isHostArch(arch)) {
        return null;
    }

    const resolved = resolveBinding(settings.paths.root, arch);

    return resolved ?? (await downloadedBinary(arch, nativeVersion(settings.paths.root)));
};

export { BINDING_FILENAME, resolveStagedAddon };
