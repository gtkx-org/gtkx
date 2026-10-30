import { dedupeDependencies, detectPackageManager, installDependencies, type PackageManager } from "nypm";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { lt, prerelease, valid } from "semver";
import { z } from "zod";
import { isGtkxPackage } from "./manifest.js";

type SupportedName = "npm" | "pnpm" | "yarn";

type Installer = {
    name: SupportedName;
    root: string;
    packageManager: PackageManager;
    isYarnClassic: boolean;
};

const SUPPORTED_NAMES: readonly string[] = ["npm", "pnpm", "yarn"] satisfies SupportedName[];
const RELEASE_PACKAGE = "@gtkx/cli";
const QUERY_OUTPUT_LIMIT = 64 * 1024 * 1024;
const NPM_LOCKFILE = "package-lock.json";
const NODE_MODULES_SEGMENT = "node_modules/";

const RegistryDocumentSchema = z.object({
    "dist-tags": z.record(z.string(), z.string()),
    versions: z.array(z.string()),
});

const RegistryOutputSchema = z.union([
    RegistryDocumentSchema,
    z.tuple([RegistryDocumentSchema]).transform(([document]) => document),
]);

const YarnClassicLineSchema = z.object({ type: z.literal("inspect"), data: RegistryDocumentSchema });

const NpmLockfileSchema = z.looseObject({ packages: z.record(z.string(), z.unknown()).optional() });

type RegistryDocument = z.infer<typeof RegistryDocumentSchema>;

const execFileAsync = promisify(execFile);

const isSupportedName = (name: string): name is SupportedName => SUPPORTED_NAMES.includes(name);

const runQuiet = async (command: string, args: string[], cwd: string): Promise<string> => {
    const { stdout } = await execFileAsync(command, args, { cwd, encoding: "utf8", maxBuffer: QUERY_OUTPUT_LIMIT });

    return stdout;
};

const majorVersion = async (packageManager: PackageManager, root: string): Promise<string | undefined> =>
    packageManager.majorVersion ??
    (packageManager.name === "yarn" ? (await runQuiet("yarn", ["--version"], root)).trim().split(".")[0] : undefined);

/**
 * Detects the package manager that installs the workspace at `root` from its `packageManager` field or lockfile.
 */
const detectInstaller = async (root: string): Promise<Installer> => {
    const detected = await detectPackageManager(root, { ignoreArgv: true });

    if (detected === undefined) {
        throw new Error(
            `Cannot tell which package manager installs ${root}: it has no lockfile or packageManager field.`,
        );
    }

    const { name } = detected;

    if (!isSupportedName(name)) {
        throw new Error(`gtkx upgrade supports npm, pnpm and Yarn, not ${name}.`);
    }

    const major = await majorVersion(detected, root);

    return {
        name,
        root,
        packageManager: { ...detected, ...(major !== undefined && { majorVersion: major }) },
        isYarnClassic: name === "yarn" && major === "1",
    };
};

const registryQuery = (installer: Installer): string[] => {
    if (installer.isYarnClassic) {
        return ["info", RELEASE_PACKAGE, "--json"];
    }

    if (installer.name === "yarn") {
        return ["npm", "info", RELEASE_PACKAGE, "--fields", "dist-tags,versions", "--json"];
    }

    return ["view", RELEASE_PACKAGE, "dist-tags", "versions", "--json"];
};

const parseRegistryOutput = (installer: Installer, output: string): RegistryDocument => {
    if (!installer.isYarnClassic) {
        return RegistryOutputSchema.parse(JSON.parse(output));
    }

    for (const line of output.split("\n").filter((entry) => entry.trim().length > 0)) {
        const parsed = YarnClassicLineSchema.safeParse(JSON.parse(line));

        if (parsed.success) {
            return parsed.data.data;
        }
    }

    throw new Error(`yarn info printed no release information for ${RELEASE_PACKAGE}`);
};

const readReleases = async (installer: Installer): Promise<RegistryDocument> => {
    try {
        return parseRegistryOutput(installer, await runQuiet(installer.name, registryQuery(installer), installer.root));
    } catch (error) {
        throw new Error(`Cannot read the ${RELEASE_PACKAGE} releases through ${installer.name}.`, { cause: error });
    }
};

/**
 * The npm dist-tag a GTKX release is published under: its prerelease identifier, such as `beta`, or `latest`.
 */
const distTagOf = (version: string): string => {
    const identifier = prerelease(version)?.[0];

    if (identifier === undefined) {
        return "latest";
    }

    return typeof identifier === "string" ? identifier : "next";
};

const newestOnTag = (releases: RegistryDocument, currentVersion: string): string => {
    const tag = distTagOf(currentVersion);
    const newest = releases["dist-tags"][tag];

    if (newest === undefined) {
        throw new Error(`The registry has no ${tag} release of GTKX. Pass the version to upgrade to.`);
    }

    if (lt(newest, currentVersion)) {
        throw new Error(
            `GTKX ${currentVersion} is newer than the newest ${tag} release, ${newest}. Pass the version to upgrade to.`,
        );
    }

    return newest;
};

/**
 * Resolves the release an upgrade moves to: `requested` when it names a published version or a dist-tag,
 * otherwise the newest release on the dist-tag of `currentVersion`.
 */
const resolveTargetVersion = async (
    installer: Installer,
    requested: string | undefined,
    currentVersion: string,
): Promise<string> => {
    const releases = await readReleases(installer);

    if (requested === undefined) {
        return newestOnTag(releases, currentVersion);
    }

    if (valid(requested) !== null && releases.versions.includes(requested)) {
        return requested;
    }

    const tagged = releases["dist-tags"][requested];

    if (tagged === undefined) {
        throw new Error(`GTKX has no release or dist-tag ${requested}.`);
    }

    return tagged;
};

const isGtkxLockEntry = (path: string): boolean =>
    path.includes(NODE_MODULES_SEGMENT) &&
    isGtkxPackage(path.slice(path.lastIndexOf(NODE_MODULES_SEGMENT) + NODE_MODULES_SEGMENT.length));

/**
 * Drops the GTKX packages from npm's lockfile so that npm resolves them afresh and keeps every other locked
 * dependency. Upgrading from releases that pinned exact sibling versions (1.x and the 2.0 betas up to
 * beta.12) otherwise fails with ERESOLVE, because npm checks the new releases against the locked ones.
 */
const releaseNpmLocks = (root: string): void => {
    const file = join(root, NPM_LOCKFILE);

    if (!existsSync(file)) {
        return;
    }

    const lockfile = NpmLockfileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    const packages = lockfile.packages ?? {};

    for (const path of Object.keys(packages).filter(isGtkxLockEntry)) {
        delete packages[path];
    }

    writeFileSync(file, `${JSON.stringify(lockfile, null, 2)}\n`);
};

/**
 * Installs the workspace with its package manager, then deduplicates where the package manager has a
 * separate step for it; Yarn 1 deduplicates during install.
 */
const installWorkspace = async (installer: Installer): Promise<void> => {
    const options = { cwd: installer.root, packageManager: installer.packageManager, corepack: false };

    if (installer.name === "npm") {
        releaseNpmLocks(installer.root);
    }

    await installDependencies(options);

    if (!installer.isYarnClassic) {
        await dedupeDependencies(options);
    }
};

export { detectInstaller, installWorkspace, resolveTargetVersion };
