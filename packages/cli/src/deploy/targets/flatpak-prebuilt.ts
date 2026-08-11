import type { DeployPayload, DeploySettings } from "../types.js";
import { optional } from "../nfpm/optional.js";

type FlatpakModule = Record<string, unknown>;

const DESTINATION = "${FLATPAK_DEST}";
const STAGE_SOURCE_PATH = "../../stage";
const OVERLAY_SOURCE_PATH = "../../overlay/flatpak";

const validationCommands = (settings: DeploySettings): string[] => {
    if (settings.deploy.flatpak?.mode !== "source") {
        return [];
    }

    const metainfo = `${DESTINATION}/share/metainfo/${settings.applicationId}.metainfo.xml`;

    return [
        `desktop-file-validate ${DESTINATION}/share/applications/${settings.applicationId}.desktop`,
        `appstreamcli validate --no-net --explain ${metainfo}`,
    ];
};

const permissionCommands = (settings: DeploySettings): string[] => [
    `chmod 755 ${DESTINATION}/bin/${settings.binaryName} ${DESTINATION}/lib/${settings.binaryName}/node`,
    `find ${DESTINATION}/lib/${settings.binaryName} -name '*.node' -exec chmod 755 {} +`,
];

const overlaySources = (payload: DeployPayload): FlatpakModule[] =>
    payload.overlays.flatpak.length === 0 ? [] : [{ type: "dir", path: OVERLAY_SOURCE_PATH, dest: "overlay" }];

const overlayCommands = (payload: DeployPayload): string[] =>
    payload.overlays.flatpak.length === 0 ? [] : [`cp -a overlay/. ${DESTINATION}/`];

const postInstallCommands = (payload: DeployPayload): string[] =>
    payload.settings.paths.schemaFiles.length === 0
        ? []
        : [`glib-compile-schemas ${DESTINATION}/share/glib-2.0/schemas`];

const flatpakPrebuiltModule = (payload: DeployPayload): FlatpakModule => {
    const settings = payload.settings;
    const postInstall = postInstallCommands(payload);

    return {
        name: settings.binaryName,
        buildsystem: "simple",
        "build-options": { strip: false, "no-debuginfo": true },
        sources: [{ type: "dir", path: STAGE_SOURCE_PATH, dest: "stage" }, ...overlaySources(payload)],
        "build-commands": [
            `cp -a stage/. ${DESTINATION}/`,
            ...overlayCommands(payload),
            ...permissionCommands(settings),
            ...(settings.deploy.flatpak?.buildCommands ?? []),
            ...validationCommands(settings),
        ],
        ...optional("post-install", postInstall.length === 0 ? undefined : postInstall),
    };
};

export { DESTINATION, type FlatpakModule, flatpakPrebuiltModule, postInstallCommands, validationCommands };
