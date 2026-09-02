import type { Config } from "@gtkx/config";
import type {
    DeployConfig,
    DeployDesktopAction,
    DeployDeveloper,
    DeployRelease,
    DeploySettings,
    DeployVersions,
} from "../types.js";
import { resolveArch } from "./arch.js";
import { resolveExecToken, resolveFileAssociations, resolveMimeTypes } from "./exec.js";
import { resolveExtraFiles } from "./extra-files.js";
import {
    type IdentityRequest,
    resolveBinaryName,
    resolveCopyright,
    resolveDescription,
    resolveDeveloper,
    resolveLicense,
    resolveMetadataLicense,
    resolveName,
    resolveSummary,
    resolveVersionString,
} from "./identity.js";
import { resolveLibraries } from "./libraries.js";
import { readPackageManifest } from "./package-manifest.js";
import { resolvePaths } from "./paths.js";
import { resolveScreenshots } from "./screenshots.js";
import { resolveVersions } from "./version.js";

type SettingsRequest = {
    root: string;
    config: Config;
    configFile: string;
    outDirOverride?: string | undefined;
    now?: Date | undefined;
};

type ResolvedCore = {
    identity: IdentityRequest;
    developer: DeployDeveloper;
    versions: DeployVersions;
    date: string;
};

type IdentitySlice = Pick<
    DeploySettings,
    | "applicationId" |
    "binaryName" |
    "copyright" |
    "description" |
    "developer" |
    "genericName" |
    "homepage" |
    "license" |
    "metadataLicense" |
    "name" |
    "summary"
>;

type MetadataSlice = Pick<
    DeploySettings,
    "branding" | "categories" | "contentRating" | "keywords" | "mimeTypes" | "releases" | "screenshots" | "urls"
>;

type DesktopSlice = Pick<
    DeploySettings,
    | "desktopActions" |
    "desktopEntry" |
    "execArgs" |
    "execToken" |
    "fileAssociations" |
    "isDbusActivatable" |
    "protocols"
>;

const ISO_DATE_LENGTH = 10;
const MILLISECONDS_PER_SECOND = 1000;

const reproducibleDate = (epoch: string | undefined): Date | null => {
    if (epoch === undefined || epoch.trim().length === 0) {
        return null;
    }

    const seconds = Number(epoch);

    return Number.isFinite(seconds) ? new Date(seconds * MILLISECONDS_PER_SECOND) : null;
};

const buildDate = (now: Date): string => {
    const stamp = reproducibleDate(process.env.SOURCE_DATE_EPOCH) ?? now;

    return stamp.toISOString().slice(0, ISO_DATE_LENGTH);
};

const newestFirst = (a: DeployRelease, b: DeployRelease): number => Number(a.date < b.date) - Number(a.date > b.date);

const resolveReleases = (deploy: DeployConfig, version: string, date: string): DeployRelease[] =>
    (deploy.releases ?? [{ version, date }])
        .map((entry) => ({
            version: entry.version,
            date: entry.date,
            type: entry.type ?? null,
            urgency: entry.urgency ?? null,
            notes: entry.notes ?? [],
            url: entry.url ?? null,
        }))
        .toSorted(newestFirst);

const resolveDesktopActions = (deploy: DeployConfig): DeployDesktopAction[] =>
    Object.entries(deploy.desktopActions ?? {}).map(([id, action]) => ({
        id,
        name: action.name,
        args: action.args ?? [],
        icon: action.icon ?? null,
    }));

const identitySlice = ({ identity, developer, date }: ResolvedCore): IdentitySlice => ({
    applicationId: identity.applicationId,
    binaryName: resolveBinaryName(identity),
    name: resolveName(identity),
    genericName: identity.deploy.genericName ?? null,
    summary: resolveSummary(identity),
    description: resolveDescription(identity),
    developer,
    license: resolveLicense(identity),
    metadataLicense: resolveMetadataLicense(identity),
    copyright: resolveCopyright(identity, developer, new Date(date).getUTCFullYear()),
    homepage: identity.deploy.homepage ?? identity.manifest.homepage,
});

const metadataSlice = (root: string, { identity, versions, date }: ResolvedCore): MetadataSlice => {
    const deploy = identity.deploy;

    return {
        keywords: deploy.keywords ?? [],
        categories: deploy.categories ?? [],
        mimeTypes: resolveMimeTypes(deploy),
        urls: deploy.urls ?? {},
        screenshots: resolveScreenshots({ root, deploy }),
        branding: deploy.branding ?? null,
        contentRating: deploy.contentRating ?? {},
        releases: resolveReleases(deploy, versions.packageVersion, date),
    };
};

const desktopSlice = (deploy: DeployConfig): DesktopSlice => ({
    execArgs: deploy.execArgs ?? [],
    execToken: resolveExecToken(deploy),
    fileAssociations: resolveFileAssociations(deploy),
    protocols: deploy.protocols ?? [],
    desktopActions: resolveDesktopActions(deploy),
    desktopEntry: deploy.desktopEntry ?? {},
    isDbusActivatable: deploy.isDbusActivatable ?? false,
});

const resolveCore = (request: SettingsRequest): ResolvedCore => {
    const identity: IdentityRequest = {
        applicationId: request.config.applicationId,
        deploy: request.config.deploy ?? {},
        manifest: readPackageManifest(request.root),
    };

    const versions = resolveVersions({
        version: resolveVersionString(identity),
        release: identity.deploy.release,
        epoch: identity.deploy.epoch,
    });

    return { identity, developer: resolveDeveloper(identity), versions, date: buildDate(request.now ?? new Date()) };
};

const resolveDeploySettings = (request: SettingsRequest): DeploySettings => {
    const core = resolveCore(request);
    const deploy = core.identity.deploy;

    return {
        configFile: request.configFile,
        ...identitySlice(core),
        ...metadataSlice(request.root, core),
        ...desktopSlice(deploy),
        extraFiles: resolveExtraFiles(request.root, deploy),
        versions: core.versions,
        arch: resolveArch(),
        paths: resolvePaths({
            root: request.root,
            deploy,
            applicationIcon: request.config.applicationIcon,
            applicationId: request.config.applicationId,
            outDirOverride: request.outDirOverride,
        }),
        ...resolveLibraries(request.root, request.config),
        deploy,
    };
};

export { resolveDeploySettings };
