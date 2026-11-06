import type { DeployArch, DeploySettings } from "../types.js";
import type { FlatpakModule } from "./flatpak-prebuilt.js";
import { DEFAULT_REGISTRY, publishedTarball } from "../npm-registry.js";
import { supportedArches } from "../settings/arch.js";
import { readPackageManifest } from "../settings/package-manifest.js";

type PnpmPin = {
    version: string;
    major: number;
    minor: number;
    sha512: string;
};

const PNPM_VERSION = "12.4.2";
const PNPM_MAJOR = 12;
const PNPM_MINOR = 4;

const PNPM_SHA512 =
    "08adc6613180275c7c9edada39dcf08c9c61ad4e7eaf330a4f3461f102b0f907423454d117f9" +
    "8e72d47fef0616070644d7bffc973a6a57f5090a6d7c368b07c9";

const PNPM_DIR = "flatpak-pnpm";
const NATIVE_PNPM_DIR = "flatpak-pnpm-native";
const PNPM_COMMAND = "pnpm";
const PNPM_PREFIX = "pnpm@";
const PNPM_TARBALL_URL = `${DEFAULT_REGISTRY}/pnpm/-/pnpm-`;
const NATIVE_PNPM_PACKAGE = "@pnpm/exe.linux-";
const NATIVE_PNPM_MAJOR = 12;
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

const PNPM_PIN_FIELD = /^pnpm@(?<version>(?<major>\d+)\.(?<minor>\d+)\.\d+)\+sha512\.(?<sha512>[\da-f]{128})$/;

const pinFromGroups = (groups: Record<string, string | undefined>): PnpmPin | null => {
    const { major, minor, sha512, version } = groups;

    if (major === undefined || minor === undefined || sha512 === undefined || version === undefined) {
        return null;
    }

    return { version, major: Number(major), minor: Number(minor), sha512 };
};

const isSupportedPin = (pin: PnpmPin): boolean =>
    pin.major === PNPM_MAJOR ||
    pin.major === STORE_V10_MAJOR ||
    (pin.major === STORE_V11_MAJOR && pin.minor >= TRUST_LOCKFILE_MINOR);

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
                "pnpm 11 from 11.3.0 on, or pnpm 12, where `--trust-lockfile` exists. " +
                "Earlier pnpm 11 releases reach the registry " +
                'during the supply-chain check and the sandbox has no network. Pin "packageManager" to one of those.',
        );
    }

    return pin;
};

const pnpmPathFor = (moduleDir: string): string => `${moduleDir}/${PNPM_DIR}`;

const hasNativeBinary = (pin: PnpmPin): boolean => pin.major >= NATIVE_PNPM_MAJOR;

const nativeBinarySource = async (pin: PnpmPin, arch: DeployArch): Promise<FlatpakModule> => {
    const name = `${NATIVE_PNPM_PACKAGE}${arch.node}`;
    const tarball = await publishedTarball({
        registry: DEFAULT_REGISTRY,
        name,
        version: pin.version,
        remedy: 'Pin "packageManager" to a pnpm release published on the npm registry.',
    });

    return {
        type: "archive",
        url: tarball.url,
        sha512: tarball.digest,
        dest: NATIVE_PNPM_DIR,
        "only-arches": [arch.flatpak],
    };
};

const nodeLauncherSource = (moduleDir: string): FlatpakModule => ({
    type: "script",
    dest: PNPM_DIR,
    "dest-filename": PNPM_COMMAND,
    commands: [`exec node ${pnpmPathFor(moduleDir)}/bin/pnpm.cjs "$@"`],
});

const pnpmSources = async (pin: PnpmPin, moduleDir: string): Promise<FlatpakModule[]> => [
    { type: "archive", url: `${PNPM_TARBALL_URL}${pin.version}.tgz`, sha512: pin.sha512, dest: PNPM_DIR },
    ...(hasNativeBinary(pin)
        ? await Promise.all(supportedArches().map((arch) => nativeBinarySource(pin, arch)))
        : [nodeLauncherSource(moduleDir)]),
];

/**
 * pnpm 12's own `pnpm` file is a placeholder that its install script replaces with the native binary, which then
 * finds the node-gyp it ships in the `dist` directory beside it. The offline build runs no install scripts, so this
 * puts the vendored binary in its place.
 */
const pnpmSetupCommands = (pin: PnpmPin): string[] =>
    hasNativeBinary(pin) ? [`install -m755 ${NATIVE_PNPM_DIR}/${PNPM_COMMAND} ${PNPM_DIR}/${PNPM_COMMAND}`] : [];

const pnpmInstallCommand = (pin: PnpmPin): string =>
    pin.major >= STORE_V11_MAJOR ? `${PNPM_INSTALL} ${TRUST_LOCKFILE}` : PNPM_INSTALL;

const pnpmStoreVersionFor = (pin: PnpmPin): string => (pin.major === STORE_V10_MAJOR ? STORE_V10 : STORE_V11);

export {
    pnpmInstallCommand,
    pnpmPathFor,
    type PnpmPin,
    pnpmSetupCommands,
    pnpmSources,
    pnpmStoreVersionFor,
    resolvePnpmPin,
};
