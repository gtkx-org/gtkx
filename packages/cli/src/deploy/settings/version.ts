import { warn } from "@gtkx/utils";
import type { DeployVersions } from "../types.js";

type VersionRequest = {
    version: string;
    release: string | undefined;
    epoch: number | undefined;
};

const DEFAULT_RELEASE = "1";
const BUILD_METADATA_SEPARATOR = "+";
const LEADING_V = /^v/;
const PRERELEASE_SEPARATOR = "-";
const UPSTREAM_PATTERN = /^\d[\d.]*$/;
const PACKAGE_VERSION_PATTERN = /^\d[\w.+~]*$/;
const RELEASE_PATTERN = /^\w[\w.+~]*$/;

const stripBuildMetadata = (version: string): string => {
    const index = version.indexOf(BUILD_METADATA_SEPARATOR);

    if (index === -1) {
        return version;
    }

    const stripped = version.slice(0, index);

    warn(
        `Dropping the build metadata from version "${version}": Debian and RPM cannot express it. ` +
        `Packaging ${stripped} instead; set \`deploy.release\` to distinguish rebuilds.`,
    );

    return stripped;
};

const packageVersionFor = (upstream: string, prerelease: string | undefined): string =>
    prerelease === undefined ? upstream : `${upstream}~${prerelease.replaceAll("-", ".")}`;

const assertMatches = (value: string, pattern: RegExp, subject: string, key: string): void => {
    if (!pattern.test(value)) {
        throw new Error(
            `Cannot package "${value}" as ${subject}: it does not match ${String(pattern)}. Set \`${key}\`.`,
        );
    }
};

const resolveVersions = ({ version, release, epoch }: VersionRequest): DeployVersions => {
    const normalized = stripBuildMetadata(version.trim().replace(LEADING_V, ""));
    const [upstream = "", ...rest] = normalized.split(PRERELEASE_SEPARATOR);
    const prerelease = rest.length > 0 ? rest.join(PRERELEASE_SEPARATOR) : undefined;
    assertMatches(upstream, UPSTREAM_PATTERN, "an upstream version", "deploy.version");
    const packageVersion = packageVersionFor(upstream, prerelease);
    assertMatches(packageVersion, PACKAGE_VERSION_PATTERN, "a package version", "deploy.version");
    const revision = release ?? DEFAULT_RELEASE;
    assertMatches(revision, RELEASE_PATTERN, "a packaging revision", "deploy.release");

    return { upstream, packageVersion, debRevision: revision, rpmRelease: revision, epoch: epoch ?? null };
};

export { resolveVersions };
