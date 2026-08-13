import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
    DeployArtifact,
    DeployManifest,
    DeployPayload,
    DeploySettings,
    DeployTarget,
    StagedFile,
} from "../types.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { copyInto, copyTree, EXECUTABLE_MODE, writeInto } from "../payload/copy-tree.js";
import { getIconSize } from "../payload/icons.js";
import { FILE_TOOL } from "../tools.js";
import { resolveAppimageTooling } from "../vendored/appimagetool.js";

const PREFIX = "/usr";
const TARGET_DIR = "appimage";
const APPRUN_FILENAME = "AppRun";
const APPDIR_NAME = "AppDir";
const USR_DIR = "usr";
const ICON_EXTENSIONS = [".svg", ".png", ".xpm"];
const EXTRACT_AND_RUN = "APPIMAGE_EXTRACT_AND_RUN";
const SCALABLE_RANK = Number.MAX_SAFE_INTEGER;

const appimageTarget: DeployTarget = {
    name: "appimage",
    prefix: PREFIX,
    tools: [FILE_TOOL],
    render: (payload) => renderManifests(payload),
    pack: (payload) => packAppImage(payload),
};

const appimageDir = (settings: DeploySettings): string => join(settings.paths.targets, TARGET_DIR);
const appDirFor = (settings: DeploySettings): string => join(appimageDir(settings), APPDIR_NAME);
const appRunPathFor = (settings: DeploySettings): string => join(appimageDir(settings), APPRUN_FILENAME);

const renderAppRun = (settings: DeploySettings): string =>
    [
        "#!/bin/sh",
        "set -e",
        'here=$(dirname "$(readlink -f "$0")")',
        'XDG_DATA_DIRS="$here/usr/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"',
        "export XDG_DATA_DIRS",
        `exec "$here/usr/bin/${settings.binaryName}" "$@"`,
        "",
    ].join("\n");

const renderManifests = (payload: DeployPayload): DeployManifest[] => [
    { path: appRunPathFor(payload.settings), contents: renderAppRun(payload.settings) },
];

const iconRank = (file: StagedFile): number =>
    file.rel.endsWith(".svg") ? SCALABLE_RANK : (getIconSize(file.rel) ?? 0);

const largestIcon = (icons: StagedFile[]): StagedFile | undefined => {
    let best: StagedFile | undefined;

    for (const file of icons) {
        if (best === undefined || iconRank(file) > iconRank(best)) {
            best = file;
        }
    }

    return best;
};

const rootIconFor = (payload: DeployPayload): { rel: string; abs: string } => {
    const { applicationId } = payload.settings;
    const names = new Set(ICON_EXTENSIONS.map((extension) => `${applicationId}${extension}`));
    const icon = largestIcon(payload.stage.filter((file) => names.has(file.rel.split("/").at(-1) ?? "")));

    if (icon === undefined) {
        throw new Error(`Cannot build an AppImage without a ${applicationId} icon in the staged icon tree`);
    }

    return { rel: icon.rel.split("/").at(-1) ?? "", abs: icon.abs };
};

const buildAppDir = (payload: DeployPayload): string => {
    const settings = payload.settings;
    const appDir = appDirFor(settings);
    rmSync(appDir, { recursive: true, force: true, maxRetries: 5 });
    copyTree(appDir, USR_DIR, settings.paths.stage);
    copyTree(appDir, USR_DIR, join(settings.paths.overlay, TARGET_DIR));
    writeInto(appDir, APPRUN_FILENAME, renderAppRun(settings), EXECUTABLE_MODE);

    copyInto(appDir, `${settings.applicationId}.desktop`, join(appDir, USR_DIR, "share/applications",
        `${settings.applicationId}.desktop`));

    const icon = rootIconFor(payload);
    copyInto(appDir, icon.rel, icon.abs);

    return appDir;
};

const artifactNameFor = (settings: DeploySettings): string =>
    settings.deploy.appimage?.fileName ??
    `${settings.name.replaceAll(" ", "_")}-${settings.versions.packageVersion}-${settings.arch.appimage}.AppImage`;

const toolArgsFor = (settings: DeploySettings, runtime: string, appDir: string, target: string): string[] => {
    const appimage = settings.deploy.appimage ?? {};
    const signing = settings.deploy.signing?.appimage;

    return [
        "--no-appstream",
        "--runtime-file",
        appimage.runtimeFile ?? runtime,
        ...(appimage.compression === undefined ? [] : ["--comp", appimage.compression]),
        ...(appimage.updateInformation === undefined ? [] : ["-u", appimage.updateInformation]),
        ...(signing === undefined ? [] : ["-s", "--sign-key", signing.gpgKeyId]),
        appDir,
        target,
    ];
};

const packAppImage = async (payload: DeployPayload): Promise<DeployArtifact[]> => {
    const settings = payload.settings;
    const tooling = await resolveAppimageTooling(settings.arch.appimage);
    const appDir = buildAppDir(payload);
    const output = settings.paths.output;
    mkdirSync(output, { recursive: true });
    const target = join(output, artifactNameFor(settings));

    runCliTool({
        tool: tooling.tool,
        args: toolArgsFor(settings, tooling.runtime, appDir, target),
        target: "the AppImage",
        shouldStream: true,
        options: { env: { ...process.env, ARCH: settings.arch.appimage, [EXTRACT_AND_RUN]: "1" } },
    });

    if (!existsSync(target)) {
        throw new Error(`appimagetool reported success but wrote no AppImage at ${target}`);
    }

    return [{ path: target, size: statSync(target).size }];
};

export { appimageTarget };
