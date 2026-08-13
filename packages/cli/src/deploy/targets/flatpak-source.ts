import { posix, relative } from "node:path";
import type { DeployPayload, DeploySettings } from "../types.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";
import { renderDbusService } from "../freedesktop/dbus-service.js";
import { renderDesktopEntry } from "../freedesktop/desktop-entry.js";
import { renderMetainfo } from "../freedesktop/metainfo.js";
import { optional } from "../nfpm/optional.js";
import { iconPathFor } from "../payload/icons.js";
import { renderLauncher } from "../payload/launcher.js";
import { DESTINATION, type FlatpakModule, postInstallCommands, validationCommands } from "./flatpak-prebuilt.js";
import {
    detectPackageManager,
    GENERATED_SOURCES,
    installCommandFor,
    nodeExtensionPathFor,
    type PackageManager,
    resolveGitSource,
} from "./flatpak-sources.js";

const LAUNCHER_FILENAME = "launcher.sh";
const MODULE_BUILD_ROOT = "/run/build";
const RUNTIME_PREFIX = "/app";
const NPM_CACHE_DIR = "flatpak-node/npm-cache";
const YARN_MIRROR_DIR = "flatpak-node/yarn-mirror";
const PLAIN_ARGUMENT = /^[\w./-]+$/;
const QUOTE_ESCAPE = String.raw`'\''`;

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

    return [
        installCommand(`${nodeExtensionPath}/bin/node`, `${lib}/node`, "m755"),
        installCommand(`dist/${BUNDLE_FILENAME}`, `${lib}/${BUNDLE_FILENAME}`, "m644"),
        installCommand("dist/gtkx.node", `${lib}/gtkx.node`, "m755"),
        "test ! -f dist/gtkx.gresource || " + installCommand("dist/gtkx.gresource", `${lib}/gtkx.gresource`, "m644"),
        "test ! -f dist/gschemas.compiled || " +
        installCommand("dist/gschemas.compiled", `${lib}/gschemas.compiled`, "m644"),
        `test ! -d dist/assets || cp -a dist/assets ${lib}/assets`,
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
];

const schemaInstallCommands = (settings: DeploySettings): string[] =>
    settings.paths.schemaFiles.map((file) => {
        const name = posix.basename(file);

        return installCommand(
            projectRelative(settings, file),
            `${DESTINATION}/share/glib-2.0/schemas/${shellArgument(name)}`,
            "m644",
        );
    });

const iconInstallCommand = (settings: DeploySettings, source: string, rel: string): string =>
    installCommand(
        projectRelative(settings, source),
        `${DESTINATION}/share/icons/${shellArgument(rel.replaceAll("\\", "/"))}`,
        "m644",
    );

const iconInstallCommands = (settings: DeploySettings): string[] => {
    const { iconsDir, iconFile } = settings.paths;

    if (iconFile !== null) {
        return [iconInstallCommand(settings, iconFile, iconPathFor(settings, iconFile))];
    }

    if (iconsDir === null) {
        return [];
    }

    return listFilesRecursive(iconsDir).map((icon) => iconInstallCommand(settings, icon.absPath, icon.rel));
};

const offlineEnvFor = (manager: PackageManager, settings: DeploySettings): Record<string, string> => {
    const moduleDir = `${MODULE_BUILD_ROOT}/${settings.binaryName}`;

    if (manager === "yarn") {
        return { YARN_OFFLINE_MIRROR: `${moduleDir}/${YARN_MIRROR_DIR}` };
    }

    return { npm_config_cache: `${moduleDir}/${NPM_CACHE_DIR}`, npm_config_offline: "true" };
};

const flatpakSourceModule = (payload: DeployPayload): FlatpakModule => {
    const settings = payload.settings;
    const manager = detectPackageManager(settings);
    const postInstall = postInstallCommands(payload);
    const nodeExtensionPath = nodeExtensionPathFor(settings);

    return {
        name: settings.binaryName,
        buildsystem: "simple",
        "build-options": {
            "append-path": `${nodeExtensionPath}/bin`,
            env: { npm_config_nodedir: nodeExtensionPath, ...offlineEnvFor(manager, settings) },
            strip: false,
            "no-debuginfo": true,
        },
        sources: [
            resolveGitSource(settings),
            GENERATED_SOURCES,
            inlineSource(`${settings.applicationId}.desktop`, renderDesktopEntry(settings)),
            inlineSource(`${settings.applicationId}.metainfo.xml`, renderMetainfo(settings)),
            inlineSource(LAUNCHER_FILENAME, renderLauncher(settings)),
            ...activationSource(settings),
        ],
        "build-commands": [
            installCommandFor(manager),
            "npx gtkx build",
            ...runtimeInstallCommands(settings, nodeExtensionPath),
            ...metadataInstallCommands(settings),
            ...schemaInstallCommands(settings),
            ...iconInstallCommands(settings),
            ...(settings.deploy.flatpak?.buildCommands ?? []),
            ...validationCommands(settings),
        ],
        ...optional("post-install", postInstall.length === 0 ? undefined : postInstall),
    };
};

export { flatpakSourceModule };
