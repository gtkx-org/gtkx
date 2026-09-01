import type { DeploySettings } from "../types.js";
import type { FlatpakModule } from "./flatpak-prebuilt.js";
import { readPackageManifest } from "../settings/package-manifest.js";

type PnpmPin = {
    version: string;
    major: number;
    minor: number;
    sha512: string;
};

const PNPM_VERSION = "11.25.0";
const PNPM_MAJOR = 11;
const PNPM_MINOR = 25;

const PNPM_SHA512 = "5cde925b4f075f725eb71fbae18a42ffe784524789f19b61c731cb8721ec28aaee160e01a" +
    "8d5af4fedb2a42cdbf300efe23db356b0d4a17b4d63e11f8ab7c956";

const PNPM_DIR = "flatpak-pnpm";
const PNPM_COMMAND = "pnpm";
const PNPM_PREFIX = "pnpm@";
const PNPM_TARBALL_URL = "https://registry.npmjs.org/pnpm/-/pnpm-";
const PNPM_INSTALL = "pnpm install --offline --frozen-lockfile";
const TRUST_LOCKFILE = "--trust-lockfile";
const STORE_V10 = "v10";
const STORE_V11 = "v11";
const STORE_V10_MAJOR = 10;
const STORE_V11_MAJOR = 11;
const TRUST_LOCKFILE_MINOR = 3;

const DEFAULT_PIN: PnpmPin = {
    version: PNPM_VERSION,
    major: PNPM_MAJOR,
    minor: PNPM_MINOR,
    sha512: PNPM_SHA512,
};

const PNPM_PIN_FIELD =
    /^pnpm@(?<version>(?<major>\d+)\.(?<minor>\d+)\.\d+)\+sha512\.(?<sha512>[\da-f]{128})$/;

const pinFromGroups = (groups: Record<string, string | undefined>): PnpmPin | null => {
    const { major, minor, sha512, version } = groups;

    if (major === undefined || minor === undefined || sha512 === undefined || version === undefined) {
        return null;
    }

    return { version, major: Number(major), minor: Number(minor), sha512 };
};

const isSupportedPin = (pin: PnpmPin): boolean =>
    pin.major === STORE_V10_MAJOR || (pin.major === STORE_V11_MAJOR && pin.minor >= TRUST_LOCKFILE_MINOR);

const resolvePnpmPin = (settings: DeploySettings): PnpmPin => {
    const field = readPackageManifest(settings.paths.root).packageManager;

    if (field === null) {
        return DEFAULT_PIN;
    }

    if (!field.startsWith(PNPM_PREFIX)) {
        throw new Error(
            `Cannot vendor pnpm for the Flathub sandbox: "packageManager" is "${field}" but the offline install ` +
            "resolves from a pnpm lockfile. Run `corepack use pnpm@<version>` to pin it to pnpm, or point " +
            "`deploy.flatpak.packageManager` at the manager whose lockfile the build should install from.",
        );
    }

    const pin = pinFromGroups(PNPM_PIN_FIELD.exec(field)?.groups ?? {});

    if (pin === null) {
        throw new Error(
            `Cannot vendor pnpm for the Flathub sandbox: "packageManager" is "${field}", which carries no sha512 ` +
            "integrity digest, and every source in a Flathub build has to be hash-pinned. Run " +
            "`corepack use pnpm@<version>` to rewrite it with its digest.",
        );
    }

    if (!isSupportedPin(pin)) {
        throw new Error(
            `Cannot vendor pnpm ${pin.version} for the Flathub sandbox: the offline install runs on pnpm 10, or on ` +
            "pnpm 11 from 11.3.0 on, where `--trust-lockfile` exists. Earlier pnpm 11 releases reach the registry " +
            'during the supply-chain check and the sandbox has no network. Pin "packageManager" to one of those.',
        );
    }

    return pin;
};

const pnpmPathFor = (moduleDir: string): string => `${moduleDir}/${PNPM_DIR}`;

const pnpmSources = (pin: PnpmPin, moduleDir: string): FlatpakModule[] => [
    { type: "archive", url: `${PNPM_TARBALL_URL}${pin.version}.tgz`, sha512: pin.sha512, dest: PNPM_DIR },
    {
        type: "script",
        dest: PNPM_DIR,
        "dest-filename": PNPM_COMMAND,
        commands: [`exec node ${pnpmPathFor(moduleDir)}/bin/pnpm.cjs "$@"`],
    },
];

const pnpmInstallCommand = (pin: PnpmPin): string =>
    pin.major === STORE_V11_MAJOR ? `${PNPM_INSTALL} ${TRUST_LOCKFILE}` : PNPM_INSTALL;

const pnpmStoreVersionFor = (pin: PnpmPin): string =>
    pin.major === STORE_V10_MAJOR ? STORE_V10 : STORE_V11;

export {
    pnpmInstallCommand,
    pnpmPathFor,
    type PnpmPin,
    pnpmSources,
    pnpmStoreVersionFor,
    resolvePnpmPin,
};
