import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { releaseChangelog, releaseVersion } from "nx/release";

type TutorialManifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

type VersionArguments = {
    preid?: string;
    specifier?: string;
};

const ROOT = join(import.meta.dirname, "..");
const VERSION_MANIFEST_PATH = join(ROOT, "packages/create-gtkx/package.json");
const VERSION_PLANS_PATH = join(ROOT, ".nx/version-plans");
const TUTORIAL_MANIFEST_PATH = join(ROOT, "examples/tutorial/package.json");
const GETTING_STARTED_PATH = join(ROOT, "website/v2/guide/getting-started.md");
const PIN_PREFIX = "  - '@gtkx/";
const GIT_OPTIONS = { stageChanges: false, gitCommit: false, gitTag: false, gitPush: false };

const readVersion = (): string =>
    (JSON.parse(readFileSync(VERSION_MANIFEST_PATH, "utf8")) as { version: string }).version;

const hasVersionPlans = (): boolean =>
    existsSync(VERSION_PLANS_PATH) && readdirSync(VERSION_PLANS_PATH).some((file) => file.endsWith(".md"));

const hasReleaseIntent = (values: VersionArguments): boolean =>
    values.specifier !== undefined || values.preid !== undefined;

const isPrerelease = (version: string): boolean => version.includes("-");

const prereleaseIdentifier = (version: string): string | undefined => {
    const at = version.indexOf("-");
    const identifier = at === -1 ? undefined : version.slice(at + 1).split(".", 1)[0];

    return identifier !== undefined && !/^\d+$/.test(identifier) ? identifier : undefined;
};

const isOnPrereleaseTrain = (currentVersion: string, values: VersionArguments): boolean =>
    isPrerelease(currentVersion) || values.preid !== undefined;

const versionArguments = (currentVersion: string, values: VersionArguments): VersionArguments => {
    const specifier = values.specifier ?? (isOnPrereleaseTrain(currentVersion, values) ? "prerelease" : undefined);
    const preid = values.preid ?? prereleaseIdentifier(currentVersion);

    return { ...(specifier !== undefined && { specifier }), ...(preid !== undefined && { preid }) };
};

const assertNamedPrerelease = (version: string | null | undefined): void => {
    if (typeof version === "string" && isPrerelease(version) && prereleaseIdentifier(version) === undefined) {
        throw new Error(`${version} has no prerelease identifier. Pass --preid to name one, such as --preid beta.`);
    }
};

const assertReleasableVersion = async (
    currentVersion: string,
    options: Parameters<typeof releaseVersion>[0],
): Promise<void> => {
    if (options.preid !== undefined || isPrerelease(currentVersion)) {
        return;
    }

    const preview = await releaseVersion({ ...options, dryRun: true });

    assertNamedPrerelease(preview.workspaceVersion);
};

const withSelfRanges = (ranges: Record<string, string>, version: string): Record<string, string> =>
    Object.fromEntries(
        Object.entries(ranges).map(([name, range]) => [name, name.startsWith("@gtkx/") ? `^${version}` : range]),
    );

const syncTutorialManifest = (version: string): void => {
    const manifest = JSON.parse(readFileSync(TUTORIAL_MANIFEST_PATH, "utf8")) as TutorialManifest;

    for (const collection of ["dependencies", "devDependencies"] as const) {
        const ranges = manifest[collection];

        if (ranges) {
            manifest[collection] = withSelfRanges(ranges, version);
        }
    }

    writeFileSync(TUTORIAL_MANIFEST_PATH, `${JSON.stringify(manifest, null, 4)}\n`);
};

const withPinnedVersion = (line: string, version: string): string => {
    const at = line.indexOf("@", PIN_PREFIX.length);

    return at !== -1 && line.startsWith(PIN_PREFIX) ? `${line.slice(0, at + 1)}${version}'` : line;
};

const syncGettingStarted = (version: string): void => {
    const lines = readFileSync(GETTING_STARTED_PATH, "utf8").split("\n");

    writeFileSync(GETTING_STARTED_PATH, lines.map((line) => withPinnedVersion(line, version)).join("\n"));
};

const main = async (): Promise<void> => {
    const { values } = parseArgs({
        options: {
            specifier: { type: "string" },
            preid: { type: "string" },
            "dry-run": { type: "boolean", default: false },
            verbose: { type: "boolean", default: false },
        },
    });
    const isDryRun = values["dry-run"];

    if (!hasReleaseIntent(values) && !hasVersionPlans()) {
        console.log("No version plans to release.");

        return;
    }

    const currentVersion = readVersion();
    const options = { ...GIT_OPTIONS, verbose: values.verbose, ...versionArguments(currentVersion, values) };

    await assertReleasableVersion(currentVersion, options);

    const { workspaceVersion, projectsVersionData, releaseGraph } = await releaseVersion({
        ...options,
        dryRun: isDryRun,
    });

    if (!workspaceVersion) {
        console.log("No version plans to release.");

        return;
    }

    if (!isDryRun) {
        syncTutorialManifest(workspaceVersion);
        syncGettingStarted(workspaceVersion);
    }

    await releaseChangelog({
        ...GIT_OPTIONS,
        dryRun: isDryRun,
        verbose: values.verbose,
        version: workspaceVersion,
        versionData: projectsVersionData,
        releaseGraph,
        createRelease: false,
    });

    console.log(`Prepared GTKX ${workspaceVersion}.`);
};

await main();
