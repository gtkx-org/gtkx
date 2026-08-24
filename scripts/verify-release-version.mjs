import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packagesDir = fileURLToPath(new URL("../packages", import.meta.url));
const rootManifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
const tutorialManifestPath = fileURLToPath(new URL("../examples/tutorial/package.json", import.meta.url));
const requested = process.argv[2];

if (requested === undefined) {
    throw new TypeError("Expected a release version");
}

const releaseVersion = requested.startsWith("v") ? requested.slice(1) : requested;
const numericIdentifier = String.raw`(?:0|[1-9]\d*)`;
const nonNumericIdentifier = String.raw`(?:\d*[A-Za-z-][0-9A-Za-z-]*)`;
const prereleaseIdentifier = `(?:${numericIdentifier}|${nonNumericIdentifier})`;
const buildIdentifier = "[0-9A-Za-z-]+";

const semver = new RegExp([
    String.raw`^${numericIdentifier}\.${numericIdentifier}\.${numericIdentifier}`,
    String.raw`(?:-${prereleaseIdentifier}(?:\.${prereleaseIdentifier})*)?`,
    String.raw`(?:\+${buildIdentifier}(?:\.${buildIdentifier})*)?$`,
].join(""));

if (!semver.test(releaseVersion)) {
    throw new TypeError("Expected a complete semantic release version");
}

if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && process.env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Manual publication is restricted to the main branch");
}

if (process.env.GITHUB_EVENT_NAME === "release" && process.env.GITHUB_REF !== `refs/tags/${requested}`) {
    throw new Error("Release publication must run from its matching tag");
}

const expectedNames = [
    "@gtkx/animated",
    "@gtkx/cairo",
    "@gtkx/cli",
    "@gtkx/codegen",
    "@gtkx/components",
    "@gtkx/config",
    "@gtkx/css",
    "@gtkx/gl",
    "@gtkx/mcp",
    "@gtkx/native",
    "@gtkx/navigation",
    "@gtkx/react",
    "@gtkx/runtime",
    "@gtkx/testing",
    "@gtkx/utils",
    "@gtkx/vitest",
    "create-gtkx",
];

const expectedNameSet = new Set(expectedNames);

const expectedTutorialDependencies = [
    "@gtkx/cairo",
    "@gtkx/components",
    "@gtkx/css",
    "@gtkx/navigation",
    "@gtkx/react",
];

const expectedTutorialDevDependencies = [
    "@gtkx/cli",
    "@gtkx/config",
    "@gtkx/testing",
];

const publicPackages = readdirSync(packagesDir).flatMap((entry) => {
    const manifestPath = join(packagesDir, entry, "package.json");

    if (!existsSync(manifestPath)) {
        return [];
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    return manifest.private === true ? [] : [{ manifest, manifestPath }];
});

const actualNames = new Set(publicPackages.map(({ manifest }) => manifest.name));
const hasDuplicateNames = actualNames.size !== publicPackages.length;
const missingNames = [];

for (const name of expectedNameSet) {
    if (!actualNames.has(name)) {
        missingNames.push(name);
    }
}

const unexpectedNames = [];

for (const name of actualNames) {
    if (!expectedNameSet.has(name)) {
        unexpectedNames.push(name);
    }
}

if (hasDuplicateNames || missingNames.length > 0 || unexpectedNames.length > 0) {
    throw new Error(
        `Release package set differs: missing ${missingNames.join(", ")}; ` +
        `unexpected ${unexpectedNames.map(String).join(", ")}; ` +
        `duplicate names ${String(hasDuplicateNames)}`,
    );
}

const mismatches = publicPackages.filter(({ manifest }) => manifest.version !== releaseVersion);

if (mismatches.length > 0) {
    const details = mismatches
        .map(
            ({ manifest, manifestPath }) =>
                `${String(manifest.name)} (${String(manifest.version)}) at ${manifestPath}`,
        )
        .join(", ");

    throw new Error(`Release version ${releaseVersion} does not match ${details}`);
}

const expectedEngine = ">=24.11.0";
const expectedLicense = "MPL-2.0";

const metadataMismatches = publicPackages.filter(
    ({ manifest }) =>
        (manifest.private !== undefined && manifest.private !== false) ||
        manifest.license !== expectedLicense ||
        manifest.engines?.node !== expectedEngine,
);

if (metadataMismatches.length > 0) {
    throw new Error(
        `Release metadata differs for ${metadataMismatches
            .map(({ manifest }) => String(manifest.name))
            .join(", ")}`,
    );
}

const packageReleaseScript = "tsx ../../scripts/release-package.ts";
const nativeReleaseScript = `tsx ../../scripts/prepublish-native.ts && ${packageReleaseScript}`;

const releaseTargetMismatches = publicPackages.filter(({ manifest }) =>
    manifest.scripts?.release !== (
        manifest.name === "@gtkx/native" ? nativeReleaseScript : packageReleaseScript
    ),
);

if (releaseTargetMismatches.length > 0) {
    throw new Error(
        `Release targets differ for ${releaseTargetMismatches
            .map(({ manifest }) => String(manifest.name))
            .join(", ")}`,
    );
}

const expectedRootEngine = ">=24.12.0";
const rootManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));

if (
    rootManifest.private !== true ||
    rootManifest.license !== expectedLicense ||
    rootManifest.engines?.node !== expectedRootEngine
) {
    throw new Error("Root workspace metadata differs");
}

const dependencyMismatches = publicPackages.flatMap(({ manifest }) =>
    [manifest.dependencies, manifest.optionalDependencies].flatMap((dependencies) =>
        Object.entries(dependencies ?? {}).flatMap(([name, range]) =>
            range !== "workspace:*" && expectedNameSet.has(name)
                ? [`${String(manifest.name)} requires ${name}@${String(range)}`]
                : [],
        ),
    ),
);

if (dependencyMismatches.length > 0) {
    throw new Error(`Release workspace dependencies differ: ${dependencyMismatches.join(", ")}`);
}

const tutorialManifest = JSON.parse(readFileSync(tutorialManifestPath, "utf8"));

if (
    tutorialManifest.private !== true ||
    tutorialManifest.license !== expectedLicense ||
    tutorialManifest.engines?.node !== expectedEngine
) {
    throw new Error("Tutorial metadata differs");
}

const tutorialSections = [
    ["dependencies", expectedTutorialDependencies],
    ["devDependencies", expectedTutorialDevDependencies],
];

const tutorialMismatches = [];

for (const [section, expected] of tutorialSections) {
    const dependencies = tutorialManifest[section] ?? {};
    const expectedSet = new Set(expected);

    for (const name of expected) {
        if (dependencies[name] !== `^${releaseVersion}`) {
            tutorialMismatches.push(`${section}.${name}@${String(dependencies[name])}`);
        }
    }

    for (const name of Object.keys(dependencies)) {
        if (expectedNameSet.has(name) && !expectedSet.has(name)) {
            tutorialMismatches.push(`${section}.${name} is unexpected`);
        }
    }
}

if (tutorialMismatches.length > 0) {
    throw new Error(`Tutorial release dependencies differ: ${tutorialMismatches.join(", ")}`);
}

console.log(`release: verified ${String(publicPackages.length)} packages at ${releaseVersion}`);
