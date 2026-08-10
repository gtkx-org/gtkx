import { posix, relative } from "node:path";
import type { DeployPayload, DeploySettings } from "../types.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { renderDesktopEntry } from "../freedesktop/desktop-entry.js";
import { renderMetainfo } from "../freedesktop/metainfo.js";
import { optional } from "../nfpm/optional.js";
import { renderLauncher } from "../payload/launcher.js";
import { DESTINATION, type FlatpakModule, postInstallCommands, validationCommands } from "./flatpak-prebuilt.js";
import {
    detectPackageManager,
    GENERATED_SOURCES,
    installCommandFor,
    resolveGitSource,
} from "./flatpak-sources.js";

const NODE_EXTENSION_PATH = "/usr/lib/sdk/node24";
const LAUNCHER_FILENAME = "launcher.sh";

const inlineSource = (fileName: string, contents: string): FlatpakModule => ({
    type: "inline",
    "dest-filename": fileName,
    contents,
});

const projectRelative = (settings: DeploySettings, path: string): string =>
    relative(settings.paths.root, path).replaceAll("\\", "/");

const installCommand = (source: string, destination: string, mode: string): string =>
    `install -D${mode} ${source} ${destination}`;

const runtimeInstallCommands = (settings: DeploySettings): string[] => {
    const lib = `${DESTINATION}/lib/${settings.binaryName}`;

    return [
        installCommand(`${NODE_EXTENSION_PATH}/bin/node`, `${lib}/node`, "m755"),
        installCommand("dist/bundle.js", `${lib}/bundle.js`, "m644"),
        installCommand("dist/gtkx.node", `${lib}/gtkx.node`, "m755"),
        "test ! -f dist/gtkx.gresource || " + installCommand("dist/gtkx.gresource", `${lib}/gtkx.gresource`, "m644"),
        "test ! -f dist/gschemas.compiled || " +
        installCommand("dist/gschemas.compiled", `${lib}/gschemas.compiled`, "m644"),
        `test ! -d dist/assets || cp -a dist/assets ${lib}/assets`,
        installCommand(LAUNCHER_FILENAME, `${DESTINATION}/bin/${settings.binaryName}`, "m755"),
    ];
};

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
];

const schemaInstallCommands = (settings: DeploySettings): string[] =>
    settings.paths.schemaFiles.map((file) => {
        const name = posix.basename(file);

        return installCommand(
            projectRelative(settings, file),
            `${DESTINATION}/share/glib-2.0/schemas/${name}`,
            "m644",
        );
    });

const iconInstallCommands = (settings: DeploySettings): string[] => {
    const iconsDir = settings.paths.iconsDir;

    if (iconsDir === null) {
        return [];
    }

    return listFilesRecursive(iconsDir).map((icon) =>
        installCommand(
            projectRelative(settings, icon.absPath),
            `${DESTINATION}/share/icons/${icon.rel.replaceAll("\\", "/")}`,
            "m644",
        ));
};

const flatpakSourceModule = (payload: DeployPayload): FlatpakModule => {
    const settings = payload.settings;
    const manager = detectPackageManager(settings);
    const postInstall = postInstallCommands(payload);

    return {
        name: settings.binaryName,
        buildsystem: "simple",
        "build-options": {
            "append-path": `${NODE_EXTENSION_PATH}/bin`,
            env: { npm_config_nodedir: NODE_EXTENSION_PATH },
            strip: false,
            "no-debuginfo": true,
        },
        sources: [
            resolveGitSource(settings),
            GENERATED_SOURCES,
            inlineSource(`${settings.applicationId}.desktop`, renderDesktopEntry(settings)),
            inlineSource(`${settings.applicationId}.metainfo.xml`, renderMetainfo(settings)),
            inlineSource(LAUNCHER_FILENAME, renderLauncher(settings)),
        ],
        "build-commands": [
            installCommandFor(manager),
            "npx gtkx build",
            ...runtimeInstallCommands(settings),
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
