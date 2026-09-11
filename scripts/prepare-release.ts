import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { releaseChangelog, releaseVersion } from "nx/release";

type TutorialManifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
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

const prereleaseIdentifier = (version: string): string | undefined => {
    const identifier = version.split("-", 2)[1]?.split(".", 1)[0];

    return identifier !== undefined && !/^\d+$/.test(identifier) ? identifier : undefined;
};

const frontmatterBumps = (source: string): string[] => {
    const lines = source.split("\n");

    if (lines[0]?.trim() !== "---") {
        return [];
    }

    const end = lines.indexOf("---", 1);

    return lines
        .slice(1, end === -1 ? lines.length : end)
        .map((line) => line.slice(line.lastIndexOf(":") + 1).trim())
        .filter(Boolean);
};

const readPlanBumps = (): string[] =>
    existsSync(VERSION_PLANS_PATH)
        ? readdirSync(VERSION_PLANS_PATH)
                .filter((file) => file.endsWith(".md"))
                .flatMap((file) => frontmatterBumps(readFileSync(join(VERSION_PLANS_PATH, file), "utf8")))
        : [];

const assertPlansMatchTrain = (version: string, specifier: string | undefined, preid: string | undefined): void => {
    if (specifier !== undefined) {
        return;
    }

    const bumps = readPlanBumps();
    const isPrerelease = version.includes("-");

    if (isPrerelease && bumps.some((bump) => !bump.startsWith("pre"))) {
        throw new Error(
            `The pending version plans (${bumps.join(", ")}) end the ${version} prerelease. ` +
            "Pass --specifier to cut that release on purpose, or make every plan a pre* bump.",
        );
    }

    if (!isPrerelease && preid === undefined && bumps.some((bump) => bump.startsWith("pre"))) {
        throw new Error(
            `The pending version plans (${bumps.join(", ")}) start a prerelease from the stable ${version}. ` +
            "Pass --preid to name it, such as --preid beta.",
        );
    }
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
    const currentVersion = readVersion();
    const preid = values.preid ?? prereleaseIdentifier(currentVersion);

    assertPlansMatchTrain(currentVersion, values.specifier, preid);

    const { workspaceVersion, projectsVersionData, releaseGraph } = await releaseVersion({
        ...GIT_OPTIONS,
        dryRun: isDryRun,
        verbose: values.verbose,
        ...(values.specifier !== undefined && { specifier: values.specifier }),
        ...(preid !== undefined && { preid }),
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
