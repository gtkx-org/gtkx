import { sortStringsBy } from "@gtkx/utils";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DeploySettings, DeployTargetName, NodeRuntime, NoticeSection, StagedFile } from "../types.js";
import { LOCALE_DIRNAME } from "../../i18n/catalogs.js";
import { BUILD_MANIFEST_FILENAME } from "../../internal/build-manifest.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";
import { renderCopyright } from "../freedesktop/copyright.js";
import { renderDbusService } from "../freedesktop/dbus-service.js";
import { renderNotices } from "../notices/render.js";
import { copyInto, EXECUTABLE_MODE, executableModeFor, writeInto } from "./copy-tree.js";
import { stageIcons } from "./icons.js";
import { NODE_FILENAME, renderLauncher } from "./launcher.js";
import { stageSchemas } from "./schemas.js";

type StageRequest = {
    settings: DeploySettings;
    node: NodeRuntime | null;
    metadata: StagedMetadata;
};

type StagedMetadata = {
    desktopEntry: string;
    metainfo: string;
    mimePackage: string | null;
};

const DIST_ICONS_DIR = "icons";
const LEGACY_PACKAGES_MANIFEST_FILENAME = "gtkx-packages.json";
const NOTICES_FILENAME = "THIRD-PARTY-NOTICES";
const NODE_LICENSE_FILENAME = "LICENSE";
const SHARE_APPLICATIONS = "share/applications";
const SHARE_METAINFO = "share/metainfo";
const SHARE_MIME_PACKAGES = "share/mime/packages";
const SHARE_DOC = "share/doc";
const SHARE_LICENSES = "share/licenses";
const SHARE_DBUS_SERVICES = "share/dbus-1/services";
const SHARE_LOCALE = `share/${LOCALE_DIRNAME}`;

const PREFIX_FOR: Record<DeployTargetName, string> = {
    appimage: "/usr",
    deb: "/usr",
    flatpak: "/app",
    rpm: "/usr",
};

const libDirFor = (settings: DeploySettings): string => `lib/${settings.binaryName}`;
const licenseDirFor = (settings: DeploySettings): string => `${SHARE_LICENSES}/${settings.binaryName}`;
const licenseDestination = (settings: DeploySettings): string => `${licenseDirFor(settings)}/LICENSE`;
const noticesDestination = (settings: DeploySettings): string => `${licenseDirFor(settings)}/${NOTICES_FILENAME}`;
const isIconAsset = (rel: string): boolean => rel === DIST_ICONS_DIR || rel.startsWith(`${DIST_ICONS_DIR}/`);

const isBuildMetadata = (rel: string): boolean =>
    rel === BUILD_MANIFEST_FILENAME || rel === LEGACY_PACKAGES_MANIFEST_FILENAME;

const isLocaleAsset = (rel: string): boolean => rel === LOCALE_DIRNAME || rel.startsWith(`${LOCALE_DIRNAME}/`);

const nodeLicenseDestination = (settings: DeploySettings): string =>
    `${licenseDirFor(settings)}/${NODE_FILENAME}/${NODE_LICENSE_FILENAME}`;

const stageRuntimeFiles = (settings: DeploySettings, root: string): StagedFile[] => {
    const dist = settings.paths.dist;

    if (!existsSync(join(dist, BUNDLE_FILENAME))) {
        throw new Error(`Cannot deploy: ${join(dist, BUNDLE_FILENAME)} is missing. Run \`gtkx build\` first.`);
    }

    return listFilesRecursive(dist)
        .filter((file) => !isIconAsset(file.rel) && !isBuildMetadata(file.rel) && !isLocaleAsset(file.rel))
        .map((file) => copyInto(root, join(libDirFor(settings), file.rel), file.absPath));
};

const stageCatalogs = (settings: DeploySettings, root: string): StagedFile[] =>
    listFilesRecursive(join(settings.paths.dist, LOCALE_DIRNAME))
        .map((file) => copyInto(root, join(SHARE_LOCALE, file.rel), file.absPath));

const stageNodeBinary = (settings: DeploySettings, root: string, node: NodeRuntime | null): StagedFile[] =>
    node === null ? [] : [copyInto(root, join(libDirFor(settings), NODE_FILENAME), node.path, EXECUTABLE_MODE)];

const stageMetadata = (settings: DeploySettings, root: string, metadata: StagedMetadata): StagedFile[] => [
    writeInto(root, join(SHARE_APPLICATIONS, `${settings.applicationId}.desktop`), metadata.desktopEntry),
    writeInto(root, join(SHARE_METAINFO, `${settings.applicationId}.metainfo.xml`), metadata.metainfo),
    ...(metadata.mimePackage === null
        ? []
        : [writeInto(root, join(SHARE_MIME_PACKAGES, `${settings.applicationId}.xml`), metadata.mimePackage)]),
];

const stageExtraFiles = (settings: DeploySettings, root: string): StagedFile[] =>
    settings.extraFiles.map((file) => {
        const source = resolve(settings.paths.root, file.source);

        return copyInto(root, file.destination, source, file.mode ?? executableModeFor(source));
    });

const byRelativePath = (files: StagedFile[]): StagedFile[] => {
    const latest: Map<string, StagedFile> = new Map();

    for (const file of files) {
        latest.set(file.rel, file);
    }

    return sortStringsBy(latest.values(), (file) => file.rel);
};

const stagePayload = ({ settings, node, metadata }: StageRequest): StagedFile[] => {
    const root = settings.paths.stage;
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });

    return byRelativePath([
        writeInto(root, join("bin", settings.binaryName), renderLauncher(settings), EXECUTABLE_MODE),
        ...stageNodeBinary(settings, root, node),
        ...stageRuntimeFiles(settings, root),
        ...stageCatalogs(settings, root),
        ...stageMetadata(settings, root, metadata),
        ...stageIcons(settings, root),
        ...stageSchemas(settings, root),
        ...stageExtraFiles(settings, root),
    ]);
};

const withoutDbusActivation = (desktopEntry: string): string =>
    desktopEntry
        .split("\n")
        .filter((line) => line !== "DBusActivatable=true")
        .join("\n");

const stageActivation = (
    settings: DeploySettings,
    root: string,
    target: DeployTargetName,
    metadata: StagedMetadata,
): StagedFile[] => {
    if (!settings.isDbusActivatable) {
        return [];
    }

    if (target === "appimage") {
        return [writeInto(
            root,
            join(SHARE_APPLICATIONS, `${settings.applicationId}.desktop`),
            withoutDbusActivation(metadata.desktopEntry),
        )];
    }

    return [writeInto(
        root,
        join(SHARE_DBUS_SERVICES, `${settings.applicationId}.service`),
        renderDbusService(settings, PREFIX_FOR[target]),
    )];
};

const stageOverlay = (
    settings: DeploySettings,
    target: DeployTargetName,
    notices: NoticeSection[],
    metadata: StagedMetadata,
): StagedFile[] => {
    const root = join(settings.paths.overlay, target);
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    const licenseFile = settings.paths.licenseFile;
    const activation = stageActivation(settings, root, target, metadata);

    if (target === "deb") {
        return [
            ...activation,
            writeInto(root, join(SHARE_DOC, settings.binaryName, "copyright"), renderCopyright(settings, notices)),
        ];
    }

    return [
        ...activation,
        ...(licenseFile === null ? [] : [copyInto(root, licenseDestination(settings), licenseFile)]),
        writeInto(root, noticesDestination(settings), renderNotices(settings, notices)),
    ];
};

const stageOverlays = (
    settings: DeploySettings,
    notices: NoticeSection[],
    metadata: StagedMetadata,
): Record<DeployTargetName, StagedFile[]> => ({
    appimage: stageOverlay(settings, "appimage", notices, metadata),
    deb: stageOverlay(settings, "deb", notices, metadata),
    flatpak: stageOverlay(settings, "flatpak", notices, metadata),
    rpm: stageOverlay(settings, "rpm", notices, metadata),
});

export {
    licenseDestination,
    nodeLicenseDestination,
    NOTICES_FILENAME,
    noticesDestination,
    type StagedMetadata,
    stageOverlays,
    stagePayload,
};
