import { existsSync, readFileSync, realpathSync } from "node:fs";
import { posix, relative, resolve } from "node:path";
import type { DeployPayload, DeploySettings } from "../types.js";
import { LOCALE_DIRNAME } from "../../i18n/catalogs.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";
import { renderDbusService } from "../freedesktop/dbus-service.js";
import { optional } from "../nfpm/optional.js";
import { renderNotices } from "../notices/render.js";
import { executableModeFor } from "../payload/copy-tree.js";
import { iconPathFor } from "../payload/icons.js";
import { renderLauncher } from "../payload/launcher.js";
import { licenseDestination, nodeLicenseDestination, NOTICES_FILENAME, noticesDestination } from "../payload/stage.js";
import { isInside } from "../settings/paths.js";
import { pnpmPathFor, type PnpmPin, pnpmSources } from "./flatpak-pnpm.js";
import { DESTINATION, type FlatpakModule, postInstallCommands, validationCommands } from "./flatpak-prebuilt.js";
import {
    detectPackageManager,
    GENERATED_SOURCES,
    installCommandFor,
    nodeExtensionPathFor,
    type PackageManager,
    pnpmPinFor,
    resolveGitSource,
} from "./flatpak-sources.js";

type InstalledFile = {
    destination: string;
    source: string;
    resolved: string;
};

const LAUNCHER_FILENAME = "launcher.sh";
const MODULE_BUILD_ROOT = "/run/build";
const RUNTIME_PREFIX = "/app";
const NPM_CACHE_DIR = "flatpak-node/npm-cache";
const YARN_MIRROR_DIR = "flatpak-node/yarn-mirror";
const PLAIN_ARGUMENT = /^[\w./-]+$/;
const QUOTE_ESCAPE = String.raw`'\''`;
const OCTAL_RADIX = 8;

const inlineSource = (fileName: string, contents: string): FlatpakModule => ({
    type: "inline",
    "dest-filename": fileName,
    contents,
});

const projectRelative = (settings: DeploySettings, path: string): string =>
    relative(settings.paths.root, path).replaceAll("\\", "/");

const shellArgument = (value: string): string =>
    PLAIN_ARGUMENT.test(value) ? value : `'${value.split("'").join(QUOTE_ESCAPE)}'`;

const pathArgument = (value: string): string => shellArgument(value.startsWith("-") ? `./${value}` : value);

const installCommand = (source: string, destination: string, mode: string): string =>
    `install -D${mode} ${pathArgument(source)} ${destination}`;

const runtimeInstallCommands = (settings: DeploySettings, nodeExtensionPath: string): string[] => {
    const lib = `${DESTINATION}/lib/${settings.binaryName}`;
    const locale = `${DESTINATION}/share/${LOCALE_DIRNAME}`;

    return [
        installCommand(`${nodeExtensionPath}/bin/node`, `${lib}/node`, "m755"),
        installCommand(`dist/${BUNDLE_FILENAME}`, `${lib}/${BUNDLE_FILENAME}`, "m644"),
        installCommand("dist/gtkx.node", `${lib}/gtkx.node`, "m755"),
        "test ! -f dist/gtkx.gresource || " + installCommand("dist/gtkx.gresource", `${lib}/gtkx.gresource`, "m644"),
        "test ! -f dist/gschemas.compiled || " +
        installCommand("dist/gschemas.compiled", `${lib}/gschemas.compiled`, "m644"),
        `test ! -d dist/assets || cp -a dist/assets ${lib}/assets`,
        `test ! -d dist/${LOCALE_DIRNAME} || { mkdir -p ${locale} && cp -a dist/${LOCALE_DIRNAME}/. ${locale}/; }`,
        installCommand(LAUNCHER_FILENAME, `${DESTINATION}/bin/${settings.binaryName}`, "m755"),
    ];
};

const activationSource = (settings: DeploySettings): FlatpakModule[] =>
    settings.isDbusActivatable
        ? [inlineSource(`${settings.applicationId}.service`, renderDbusService(settings, RUNTIME_PREFIX))]
        : [];

const activationInstallCommands = (settings: DeploySettings): string[] =>
    settings.isDbusActivatable
        ? [installCommand(
                `${settings.applicationId}.service`,
                `${DESTINATION}/share/dbus-1/services/${settings.applicationId}.service`,
                "m644",
            )]
        : [];

const stagedContents = (payload: DeployPayload, destination: string): string => {
    const file = payload.stage.find((candidate) => candidate.rel === destination);

    if (file === undefined) {
        throw new Error(`Cannot render the source Flatpak: ${destination} was not staged`);
    }

    return readFileSync(file.abs, "utf8");
};

const stagedMetadataSources = (payload: DeployPayload): FlatpakModule[] => {
    const settings = payload.settings;

    return [
        inlineSource(
            `${settings.applicationId}.desktop`,
            stagedContents(payload, posix.join("share", "applications", `${settings.applicationId}.desktop`)),
        ),
        inlineSource(
            `${settings.applicationId}.metainfo.xml`,
            stagedContents(payload, posix.join("share", "metainfo", `${settings.applicationId}.metainfo.xml`)),
        ),
        ...(settings.fileAssociations.length === 0
            ? []
            : [inlineSource(
                    `${settings.applicationId}.xml`,
                    stagedContents(payload, posix.join("share", "mime", "packages", `${settings.applicationId}.xml`)),
                )]),
    ];
};

const mimeInstallCommands = (settings: DeploySettings): string[] =>
    settings.fileAssociations.length === 0
        ? []
        : [installCommand(
                `${settings.applicationId}.xml`,
                `${DESTINATION}/share/mime/packages/${settings.applicationId}.xml`,
                "m644",
            )];

const metadataInstallCommands = (settings: DeploySettings): string[] => [
    installCommand(
        `${settings.applicationId}.desktop`,
        `${DESTINATION}/share/applications/${settings.applicationId}.desktop`,
        "m644",
    ),
    installCommand(
        `${settings.applicationId}.metainfo.xml`,
        `${DESTINATION}/share/metainfo/${settings.applicationId}.metainfo.xml`,
        "m644",
    ),
    ...activationInstallCommands(settings),
    ...mimeInstallCommands(settings),
];

const schemaInstallCommands = (settings: DeploySettings): string[] =>
    settings.paths.schemaFiles.map((file) => {
        const name = posix.basename(file);
        const source = projectRelative(settings, file);
        const destination = `${DESTINATION}/share/glib-2.0/schemas/${shellArgument(name)}`;
        assertInsideProject(settings, { destination, source, resolved: file });

        return installCommand(source, destination, "m644");
    });

const iconInstallCommand = (settings: DeploySettings, source: string, rel: string): string =>
    installCommand(
        projectRelative(settings, source),
        `${DESTINATION}/share/icons/${shellArgument(rel.replaceAll("\\", "/"))}`,
        "m644",
    );

const iconInstallCommands = (settings: DeploySettings): string[] => {
    const source = settings.paths.applicationIcon;

    if (source.kind === "file") {
        return [iconInstallCommand(settings, source.path, iconPathFor(settings, source.path))];
    }

    if (source.kind === "none") {
        return [];
    }

    return listFilesRecursive(source.path).map((icon) => iconInstallCommand(settings, icon.absPath, icon.rel));
};

const assertInsideProject = (settings: DeploySettings, installed: InstalledFile): void => {
    const { resolved } = installed;
    const target = existsSync(resolved) ? realpathSync(resolved) : resolved;

    if (isInside(settings.paths.root, target)) {
        return;
    }

    throw new Error(
        `Cannot install "${installed.destination}" from "${installed.source}": a source-mode manifest builds from ` +
        `your git checkout, so every file it installs has to live inside ${settings.paths.root} and be committed. ` +
        "Move it into the project, or drop it from the source build.",
    );
};

const licenseInstallCommands = (settings: DeploySettings): string[] => {
    const licenseFile = settings.paths.licenseFile;

    if (licenseFile === null) {
        return [];
    }

    const destination = licenseDestination(settings);
    assertInsideProject(settings, { destination, source: licenseFile, resolved: licenseFile });
    const target = `${DESTINATION}/${shellArgument(destination)}`;

    return [installCommand(projectRelative(settings, licenseFile), target, "m644")];
};

const noticesInstallCommands = (settings: DeploySettings): string[] => {
    const extensionLicense = `${nodeExtensionPathFor(settings)}/LICENSE`;
    const nodeTarget = `${DESTINATION}/${shellArgument(nodeLicenseDestination(settings))}`;

    return [
        installCommand(NOTICES_FILENAME, `${DESTINATION}/${shellArgument(noticesDestination(settings))}`, "m644"),
        `test ! -f ${extensionLicense} || ${installCommand(extensionLicense, nodeTarget, "m644")}`,
    ];
};

const extraFileInstallCommands = (settings: DeploySettings): string[] =>
    settings.extraFiles.map((file) => {
        const resolved = resolve(settings.paths.root, file.source);
        assertInsideProject(settings, { destination: file.destination, source: file.source, resolved });
        const mode = file.mode ?? executableModeFor(resolved);

        return installCommand(
            projectRelative(settings, resolved),
            `${DESTINATION}/${shellArgument(file.destination)}`,
            `m${mode.toString(OCTAL_RADIX)}`,
        );
    });

const moduleDirFor = (settings: DeploySettings): string => `${MODULE_BUILD_ROOT}/${settings.binaryName}`;

const offlineEnvFor = (manager: PackageManager, settings: DeploySettings): Record<string, string> => {
    if (manager === "pnpm") {
        return {};
    }

    if (manager === "yarn") {
        return { YARN_OFFLINE_MIRROR: `${moduleDirFor(settings)}/${YARN_MIRROR_DIR}` };
    }

    return { npm_config_cache: `${moduleDirFor(settings)}/${NPM_CACHE_DIR}`, npm_config_offline: "true" };
};

const appendPathFor = (settings: DeploySettings, pin: PnpmPin | null, nodeExtensionPath: string): string =>
    pin === null
        ? `${nodeExtensionPath}/bin`
        : `${pnpmPathFor(moduleDirFor(settings))}:${nodeExtensionPath}/bin`;

const flatpakSourceModule = (payload: DeployPayload): FlatpakModule => {
    const settings = payload.settings;
    const manager = detectPackageManager(settings);
    const pin = pnpmPinFor(settings, manager);
    const postInstall = postInstallCommands(payload);
    const nodeExtensionPath = nodeExtensionPathFor(settings);

    return {
        name: settings.binaryName,
        buildsystem: "simple",
        "build-options": {
            "append-path": appendPathFor(settings, pin, nodeExtensionPath),
            env: { npm_config_nodedir: nodeExtensionPath, ...offlineEnvFor(manager, settings) },
            strip: false,
            "no-debuginfo": true,
        },
        sources: [
            resolveGitSource(settings),
            ...(pin === null ? [] : pnpmSources(pin, moduleDirFor(settings))),
            GENERATED_SOURCES,
            ...stagedMetadataSources(payload),
            inlineSource(LAUNCHER_FILENAME, renderLauncher(settings)),
            inlineSource(NOTICES_FILENAME, renderNotices(settings, payload.notices)),
            ...activationSource(settings),
        ],
        "build-commands": [
            installCommandFor(settings, manager),
            "npx gtkx build",
            ...runtimeInstallCommands(settings, nodeExtensionPath),
            ...metadataInstallCommands(settings),
            ...schemaInstallCommands(settings),
            ...iconInstallCommands(settings),
            ...licenseInstallCommands(settings),
            ...noticesInstallCommands(settings),
            ...extraFileInstallCommands(settings),
            ...(settings.deploy.flatpak?.buildCommands ?? []),
            ...validationCommands(settings),
        ],
        ...optional("post-install", postInstall.length === 0 ? undefined : postInstall),
    };
};

export { flatpakSourceModule };
