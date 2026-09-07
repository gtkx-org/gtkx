import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { DeployArchName, DeploySettings } from "./types.js";
import { runCliTool } from "../internal/run-cli-tool.js";
import { cacheDir, downloadFile, readCachedDigest, writeAtomically } from "./download.js";
import { isHostArch } from "./settings/arch.js";

type ProjectRequire = ReturnType<typeof createRequire>;
type Tarball = { url: string; digest: string };

const BINDING_FILENAME = "gtkx.node";
const DEFAULT_REGISTRY = "https://registry.npmjs.org";
const NATIVE_MANIFEST = "@gtkx/native/package.json";
const PACKAGE_ROOT = "package";
const REQUEST_TIMEOUT = 30_000;
const SRI_PREFIX = "sha512-";
const STRIP_COMPONENTS = "1";

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

const projectRequireFor = (root: string): ProjectRequire => createRequire(join(root, "package.json"));

const localBinary = (projectRequire: ProjectRequire, arch: DeployArchName): string | null => {
    const nativeRoot = dirname(projectRequire.resolve(NATIVE_MANIFEST));
    const candidate = join(nativeRoot, binaryFilename(arch));

    return existsSync(candidate) ? candidate : null;
};

const installedBinary = (projectRequire: ProjectRequire, arch: DeployArchName): string | null => {
    try {
        return projectRequire.resolve(platformPackage(arch));
    } catch {
        return null;
    }
};

const manifestVersion = (manifest: unknown): string | null => {
    if (typeof manifest !== "object" || manifest === null || !("version" in manifest)) {
        return null;
    }

    return typeof manifest.version === "string" ? manifest.version : null;
};

const nativeVersion = (projectRequire: ProjectRequire): string => {
    const parsed: unknown = JSON.parse(readFileSync(projectRequire.resolve(NATIVE_MANIFEST), "utf8"));
    const version = manifestVersion(parsed);

    if (version === null) {
        throw new Error("Cannot read the version of @gtkx/native; is it installed?");
    }

    return version;
};

const hexFromIntegrity = (integrity: unknown, subject: string): string => {
    if (typeof integrity !== "string" || !integrity.startsWith(SRI_PREFIX)) {
        throw new Error(`The npm registry publishes no sha512 integrity for ${subject}`);
    }

    return Buffer.from(integrity.slice(SRI_PREFIX.length), "base64").toString("hex");
};

const fetchVersionDocument = async (url: string, subject: string): Promise<Record<string, unknown>> => {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) {
        throw new Error(
            `Cannot fetch ${subject}: HTTP ${String(response.status)} ${response.statusText}. ` +
            `Install ${subject} directly, or drop that architecture from --arch.`,
        );
    }

    const document: unknown = await response.json();

    if (typeof document !== "object" || document === null) {
        throw new Error(`The npm registry returned no metadata for ${subject}`);
    }

    return document as Record<string, unknown>;
};

const publishedTarball = async (arch: DeployArchName, version: string): Promise<Tarball> => {
    const registry = registryUrl();
    const subject = `${platformPackage(arch)}@${version}`;
    const url = `${registry}/${encodeURIComponent(platformPackage(arch))}/${version}`;
    const document = await fetchVersionDocument(url, subject);
    const dist: unknown = document.dist;

    if (typeof dist !== "object" || dist === null) {
        throw new Error(`The npm registry returned no tarball for ${subject}`);
    }

    const entry = dist as Record<string, unknown>;
    const tarball = entry.tarball;

    if (typeof tarball !== "string" || new URL(tarball).origin !== new URL(registry).origin) {
        throw new Error(`The npm registry returned an unusable tarball URL for ${subject}`);
    }

    return { url: tarball, digest: hexFromIntegrity(entry.integrity, subject) };
};

const extractAddon = (archive: string, dir: string, arch: DeployArchName): void => {
    runCliTool({
        tool: "tar",
        args: ["-xzf", archive, "-C", dir, "--strip-components", STRIP_COMPONENTS,
            `${PACKAGE_ROOT}/${binaryFilename(arch)}`],
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

    const published = await publishedTarball(arch, version);
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

const resolveStagedAddon = async (settings: DeploySettings, canDownload: boolean): Promise<string | null> => {
    const arch = settings.arch.node;

    if (isHostArch(arch)) {
        return null;
    }

    const projectRequire = projectRequireFor(settings.paths.root);
    const resolved = localBinary(projectRequire, arch) ?? installedBinary(projectRequire, arch);

    if (resolved !== null || !canDownload) {
        return resolved;
    }

    return await downloadedBinary(arch, nativeVersion(projectRequire));
};

export { BINDING_FILENAME, resolveStagedAddon };
