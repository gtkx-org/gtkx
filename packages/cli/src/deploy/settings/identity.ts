import type { DeployConfig, DeployDeveloper } from "../types.js";
import type { PackageManifest } from "./package-manifest.js";

type IdentityRequest = {
    applicationId: string;
    deploy: DeployConfig;
    manifest: PackageManifest;
};

const DEFAULT_METADATA_LICENSE = "CC0-1.0";
const NAME_SEPARATORS = /[_-]+/;
const NON_NAME_CHARACTERS = /[^a-z\d]+/;
const SCOPE_PREFIX = /^@[^/]+\//;
const BINARY_NAME_PATTERN = /^[a-z\d][a-z\d+.-]+$/;

const lastSegment = (applicationId: string): string => applicationId.split(".").at(-1) ?? applicationId;

const titleCase = (value: string): string =>
    value
        .split(NAME_SEPARATORS)
        .filter((word) => word.length > 0)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const normalizePackageName = (value: string): string =>
    value
        .replace(SCOPE_PREFIX, "")
        .toLowerCase()
        .split(NON_NAME_CHARACTERS)
        .filter((part) => part.length > 0)
        .join("-");

const resolveBinaryName = ({ applicationId, deploy, manifest }: IdentityRequest): string => {
    const configured = deploy.binaryName;
    const derived = normalizePackageName(configured ?? manifest.name ?? lastSegment(applicationId));

    if (!BINARY_NAME_PATTERN.test(derived)) {
        throw new Error(
            `Cannot use "${derived}" as a package name: it must match ${String(BINARY_NAME_PATTERN)}. ` +
            "Set `deploy.binaryName`.",
        );
    }

    return derived;
};

const resolveName = ({ applicationId, deploy, manifest }: IdentityRequest): string =>
    deploy.name ?? titleCase(manifest.name?.replace(SCOPE_PREFIX, "") ?? lastSegment(applicationId));

const resolveSummary = ({ deploy, manifest }: IdentityRequest): string => {
    const summary = deploy.summary ?? manifest.description?.split("\n", 1)[0];

    if (summary === undefined) {
        throw new Error(
            "Cannot deploy without a summary: set `deploy.summary` in gtkx.config.ts, " +
            "or `description` in package.json.",
        );
    }

    return summary;
};

const resolveDescription = (request: IdentityRequest): string[] => {
    const configured = request.deploy.description;

    return configured === undefined || configured.length === 0 ? [resolveSummary(request)] : configured;
};

const resolveDeveloperId = (applicationId: string): string | null => {
    const segments = applicationId.split(".");

    return segments.length > 2 ? segments.slice(0, -1).join(".") : null;
};

const resolveDeveloper = ({ applicationId, deploy, manifest }: IdentityRequest): DeployDeveloper => {
    const name = deploy.developer?.name ?? manifest.author.name;

    if (name === null) {
        throw new Error(
            "Cannot deploy without a developer: set `deploy.developer.name` in gtkx.config.ts, " +
            "or `author` in package.json.",
        );
    }

    return {
        id: deploy.developer?.id ?? resolveDeveloperId(applicationId),
        name,
        email: deploy.developer?.email ?? manifest.author.email,
    };
};

const resolveLicense = ({ deploy, manifest }: IdentityRequest): string => {
    const license = deploy.license ?? manifest.license;

    if (license === null) {
        throw new Error(
            "Cannot deploy without a license: set `deploy.license` in gtkx.config.ts, or `license` in package.json.",
        );
    }

    return license;
};

const resolveVersionString = ({ deploy, manifest }: IdentityRequest): string => {
    const version = deploy.version ?? manifest.version;

    if (version === null) {
        throw new Error(
            "Cannot deploy without a version: set `deploy.version` in gtkx.config.ts, or `version` in package.json.",
        );
    }

    return version;
};

const resolveCopyright = (request: IdentityRequest, developer: DeployDeveloper, year: number): string =>
    request.deploy.copyright ?? `Copyright © ${String(year)} ${developer.name}`;

const resolveMetadataLicense = ({ deploy }: IdentityRequest): string =>
    deploy.metadataLicense ?? DEFAULT_METADATA_LICENSE;

export {
    type IdentityRequest,
    normalizePackageName,
    resolveBinaryName,
    resolveCopyright,
    resolveDescription,
    resolveDeveloper,
    resolveLicense,
    resolveMetadataLicense,
    resolveName,
    resolveSummary,
    resolveVersionString,
};
