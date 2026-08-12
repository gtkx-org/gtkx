import { sortStringsBy } from "@gtkx/utils";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DeploySettings, DeployTargetName, NodeRuntime, StagedFile } from "../types.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { renderCopyright } from "../freedesktop/copyright.js";
import { renderDbusService } from "../freedesktop/dbus-service.js";
import { renderDesktopEntry } from "../freedesktop/desktop-entry.js";
import { copyInto, EXECUTABLE_MODE, writeInto } from "./copy-tree.js";
import { stageIcons } from "./icons.js";
import { BUNDLE_FILENAME, NODE_FILENAME, renderLauncher } from "./launcher.js";
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
const SHARE_APPLICATIONS = "share/applications";
const SHARE_METAINFO = "share/metainfo";
const SHARE_MIME_PACKAGES = "share/mime/packages";
const SHARE_DOC = "share/doc";
const SHARE_LICENSES = "share/licenses";
const SHARE_DBUS_SERVICES = "share/dbus-1/services";

const PREFIX_FOR: Record<DeployTargetName, string> = {
    appimage: "/usr",
    deb: "/usr",
    flatpak: "/app",
    rpm: "/usr",
};

const libDirFor = (settings: DeploySettings): string => `lib/${settings.binaryName}`;
const isIconAsset = (rel: string): boolean => rel === DIST_ICONS_DIR || rel.startsWith(`${DIST_ICONS_DIR}/`);

const stageRuntimeFiles = (settings: DeploySettings, root: string): StagedFile[] => {
    const dist = settings.paths.dist;

    if (!existsSync(join(dist, BUNDLE_FILENAME))) {
        throw new Error(`Cannot deploy: ${join(dist, BUNDLE_FILENAME)} is missing. Run \`gtkx build\` first.`);
    }

    return listFilesRecursive(dist)
        .filter((file) => !isIconAsset(file.rel))
        .map((file) => copyInto(root, join(libDirFor(settings), file.rel), file.absPath));
};

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
    Object.entries(settings.extraFiles).map(([destination, source]) =>
        copyInto(root, destination, resolve(settings.paths.root, source)));

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
        ...stageMetadata(settings, root, metadata),
        ...stageIcons(settings, root),
        ...stageSchemas(settings, root),
        ...stageExtraFiles(settings, root),
    ]);
};

const stageActivation = (settings: DeploySettings, root: string, target: DeployTargetName): StagedFile[] => {
    if (!settings.isDbusActivatable) {
        return [];
    }

    if (target === "appimage") {
        return [writeInto(
            root,
            join(SHARE_APPLICATIONS, `${settings.applicationId}.desktop`),
            renderDesktopEntry({ ...settings, isDbusActivatable: false }),
        )];
    }

    return [writeInto(
        root,
        join(SHARE_DBUS_SERVICES, `${settings.applicationId}.service`),
        renderDbusService(settings, PREFIX_FOR[target]),
    )];
};

const stageOverlay = (settings: DeploySettings, target: DeployTargetName): StagedFile[] => {
    const root = join(settings.paths.overlay, target);
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    const licenseFile = settings.paths.licenseFile;
    const activation = stageActivation(settings, root, target);

    if (target === "deb") {
        return [
            ...activation,
            writeInto(root, join(SHARE_DOC, settings.binaryName, "copyright"), renderCopyright(settings)),
        ];
    }

    return [
        ...activation,
        ...(licenseFile === null
            ? []
            : [copyInto(root, join(SHARE_LICENSES, settings.binaryName, "LICENSE"), licenseFile)]),
    ];
};

const stageOverlays = (settings: DeploySettings): Record<DeployTargetName, StagedFile[]> => ({
    appimage: stageOverlay(settings, "appimage"),
    deb: stageOverlay(settings, "deb"),
    flatpak: stageOverlay(settings, "flatpak"),
    rpm: stageOverlay(settings, "rpm"),
});

export { type StagedMetadata, stageOverlays, stagePayload };
