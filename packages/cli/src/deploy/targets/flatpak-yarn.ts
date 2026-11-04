import { existsSync, readFileSync } from "node:fs";
import type { DeploySettings } from "../types.js";
import type { FlatpakModule } from "./flatpak-prebuilt.js";
import { DEFAULT_REGISTRY, publishedTarball } from "../npm-registry.js";
import { readPackageManifest } from "../settings/package-manifest.js";

type YarnPin = {
    version: string;
    sha512: string | null;
};

type YarnRelease = {
    source: FlatpakModule;
    script: string;
};

const YARN_DIR = "flatpak-yarn";
const YARN_COMMAND = "yarn";
const YARN_RELEASE_SCRIPT = "yarn.cjs";
const YARN_DIST_SCRIPT = "bin/yarn.js";
const YARN_PREFIX = "yarn@";
const YARN_RELEASE_URL = "https://repo.yarnpkg.com";
const YARN_RELEASE_PATH = "packages/yarnpkg-cli/bin/yarn.js";
const YARN_DIST_PACKAGE = "@yarnpkg/cli-dist";
const BERRY_MAJOR = 2;
const BERRY_GLOBAL_FOLDER = "flatpak-node/yarn-berry";
const BERRY_PLUGIN = "flatpak-node/flatpak-yarn.js";
const BERRY_INSTALL = "yarn install --immutable";
const BERRY_LOCKFILE_METADATA = /^__metadata:/m;

const YARN_PIN_FIELD = /^yarn@(?<version>(?<major>\d+)\.\d+\.\d+(?:-[\w.]+)?)(?:\+sha512\.(?<sha512>[\da-f]{128}))?$/;

/**
 * Whether the lockfile was written by Yarn 2 or later, which records a `__metadata` entry that Yarn 1's
 * format lacks. flatpak-node-generator tells the two formats apart the same way.
 */
const isBerryLockfile = (lockfile: string): boolean =>
    existsSync(lockfile) && BERRY_LOCKFILE_METADATA.test(readFileSync(lockfile, "utf8"));

const resolveYarnPin = (settings: DeploySettings): YarnPin => {
    const field = readPackageManifest(settings.paths.root).packageManager;

    if (field === null) {
        throw new Error(
            "Cannot vendor Yarn for the Flathub sandbox: yarn.lock was written by Yarn 2 or later, but package.json " +
                'has no "packageManager" field naming the release to install with, and the SDK only ships Yarn 1. ' +
                "Run `corepack use yarn@<version>` to pin it.",
        );
    }

    if (!field.startsWith(YARN_PREFIX)) {
        throw new Error(
            `Cannot vendor Yarn for the Flathub sandbox: "packageManager" is "${field}" but the offline install ` +
                "resolves from a yarn.lock. Run `corepack use yarn@<version>` to pin it to Yarn, or point " +
                "`deploy.flatpak.packageManager` at the manager whose lockfile the build should install from.",
        );
    }

    const groups = YARN_PIN_FIELD.exec(field)?.groups ?? {};
    const { major, sha512, version } = groups;

    if (major === undefined || version === undefined) {
        throw new Error(
            `Cannot vendor Yarn for the Flathub sandbox: "packageManager" is "${field}", which names no exact ` +
                "Yarn release with an optional sha512 digest. Run `corepack use yarn@<version>` to rewrite it.",
        );
    }

    if (Number(major) < BERRY_MAJOR) {
        throw new Error(
            `Cannot install with Yarn ${version} in the Flathub sandbox: yarn.lock was written by Yarn 2 or later, ` +
                'which Yarn 1 cannot read. Pin "packageManager" to the Yarn release that wrote the lockfile.',
        );
    }

    return { version, sha512: sha512 ?? null };
};

const yarnPathFor = (moduleDir: string): string => `${moduleDir}/${YARN_DIR}`;

/**
 * A pin with a digest fetches the exact file Corepack verifies against it, saved as CommonJS because the
 * project's `"type": "module"` would otherwise apply to it; a bare version falls back to the
 * `@yarnpkg/cli-dist` tarball, which carries the same file under the checksum the npm registry publishes.
 */
const yarnRelease = async (pin: YarnPin): Promise<YarnRelease> => {
    if (pin.sha512 !== null) {
        return {
            source: {
                type: "file",
                url: `${YARN_RELEASE_URL}/${pin.version}/${YARN_RELEASE_PATH}`,
                sha512: pin.sha512,
                dest: YARN_DIR,
                "dest-filename": YARN_RELEASE_SCRIPT,
            },
            script: YARN_RELEASE_SCRIPT,
        };
    }

    const tarball = await publishedTarball({
        registry: DEFAULT_REGISTRY,
        name: YARN_DIST_PACKAGE,
        version: pin.version,
        remedy: 'Pin "packageManager" to a Yarn release published on the npm registry.',
    });

    return {
        source: { type: "archive", url: tarball.url, sha512: tarball.digest, dest: YARN_DIR },
        script: YARN_DIST_SCRIPT,
    };
};

const yarnSources = async (pin: YarnPin, moduleDir: string): Promise<FlatpakModule[]> => {
    const release = await yarnRelease(pin);

    return [
        release.source,
        {
            type: "script",
            dest: YARN_DIR,
            "dest-filename": YARN_COMMAND,
            commands: [`exec node ${yarnPathFor(moduleDir)}/${release.script} "$@"`],
        },
    ];
};

/**
 * flatpak-node-generator's offline recipe for Yarn 2 or later: its sources fill the global folder's cache with
 * registry tarballs, and its plugin's `convertToZip` turns them into the zip archives the lockfile checksums.
 * The command takes the Yarn 1 that packs Yarn 1 Git dependencies, which the SDK extension ships.
 */
const yarnSetupCommands = (moduleDir: string, nodeExtensionPath: string): string[] => [
    `${YARN_COMMAND} plugin import ${moduleDir}/${BERRY_PLUGIN}`,
    `${YARN_COMMAND} convertToZip ${nodeExtensionPath}/bin/${YARN_COMMAND}`,
];

const yarnOfflineEnv = (moduleDir: string): Record<string, string> => ({
    YARN_ENABLE_NETWORK: "0",
    YARN_ENABLE_GLOBAL_CACHE: "0",
    YARN_GLOBAL_FOLDER: `${moduleDir}/${BERRY_GLOBAL_FOLDER}`,
});

export {
    BERRY_INSTALL,
    isBerryLockfile,
    resolveYarnPin,
    yarnOfflineEnv,
    yarnPathFor,
    type YarnPin,
    yarnSetupCommands,
    yarnSources,
};
