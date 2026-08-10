const RELEASE_AGE_PATTERN = /ERR_PNPM_(?:MINIMUM_RELEASE_AGE_VIOLATION|NO_MATURE_MATCHING_VERSION)/;
const BLOCKED_VERSION_PATTERN = /^[ \t]*(\S+) was published at .+ within the minimumReleaseAge cutoff/gm;

const RELEASE_AGE_POLICY =
    "pnpm refused the install under its minimumReleaseAge policy, which by default holds back every package " +
    "published in the last 24 hours so a compromised release has time to be caught and pulled. Nothing is wrong " +
    "with these versions other than their age.";

const RELEASE_AGE_REMEDY =
    "Wait for them to clear that window and install again, or allow the versions pnpm named. They belong at the " +
    "top level of pnpm-workspace.yaml, as a sibling of packages: and allowBuilds: rather than nested inside " +
    "either of them:";

const RELEASE_AGE_REMEDY_WITHOUT_VERSIONS =
    "Wait for them to clear that window and install again, or list the versions pnpm reported under a top-level " +
    "minimumReleaseAgeExclude key in pnpm-workspace.yaml.";

const RELEASE_AGE_PARTIAL_LIST =
    "pnpm reports only the versions the command it stopped on had to resolve, so a later install can name more. " +
    "Add each one to the same list.";

const RELEASE_AGE_OPT_OUT =
    'Listing exact versions keeps the policy on for every other package. Setting "minimumReleaseAge: 0" in the ' +
    "same file turns it off for all of them, so prefer the list above. npm and yarn apply no such policy.";

const getBlockedVersions = (message: string): string[] => {
    const matches = Array.from(message.matchAll(BLOCKED_VERSION_PATTERN), (match) => match[1] ?? "");

    return [...new Set(matches.filter(Boolean))];
};

const formatExcludeBlock = (versions: string[]): string =>
    ["minimumReleaseAgeExclude:", ...versions.map((version) => `  - '${version}'`)].join("\n");

const describeReleaseAge = (message: string): string => {
    const versions = getBlockedVersions(message);

    if (versions.length === 0) {
        return [RELEASE_AGE_POLICY, RELEASE_AGE_REMEDY_WITHOUT_VERSIONS].join("\n\n");
    }

    return [
        RELEASE_AGE_POLICY,
        RELEASE_AGE_REMEDY,
        formatExcludeBlock(versions),
        RELEASE_AGE_PARTIAL_LIST,
        RELEASE_AGE_OPT_OUT,
    ].join("\n\n");
};

const getInstallHint = (message: string): string | undefined =>
    RELEASE_AGE_PATTERN.test(message) ? describeReleaseAge(message) : undefined;

export { getInstallHint };
