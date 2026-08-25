import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
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
import { type ApplicationIconVariant, classifyApplicationIcon } from "../payload/icons.js";
import { FILE_TOOL } from "../tools.js";
import { resolveAppimageTooling } from "../vendored/appimagetool.js";

type RankedIcon = {
    file: StagedFile;
    variant: ApplicationIconVariant;
};

const PREFIX = "/usr";
const TARGET_DIR = "appimage";
const APPRUN_FILENAME = "AppRun";
const APPDIR_NAME = "AppDir";
const USR_DIR = "usr";
const EXTRACT_AND_RUN = "APPIMAGE_EXTRACT_AND_RUN";

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

const rankedIcon = (applicationId: string, file: StagedFile): RankedIcon | null => {
    const variant = classifyApplicationIcon(applicationId, file.rel);

    return variant === null ? null : { file, variant };
};

const isLargerIcon = (candidate: RankedIcon, best: RankedIcon): boolean =>
    candidate.variant.scalable === best.variant.scalable
        ? candidate.variant.effectivePixels > best.variant.effectivePixels
        : candidate.variant.scalable;

const largerIcon = (best: RankedIcon | undefined, candidate: RankedIcon): RankedIcon =>
    best === undefined || isLargerIcon(candidate, best) ? candidate : best;

const largestIcon = (applicationId: string, files: StagedFile[]): StagedFile | undefined => {
    let best: RankedIcon | undefined;

    for (const file of files) {
        const candidate = rankedIcon(applicationId, file);

        if (candidate === null) {
            continue;
        }

        best = largerIcon(best, candidate);
    }

    return best?.file;
};

const rootIconFor = (payload: DeployPayload): { rel: string; abs: string } => {
    const { applicationId } = payload.settings;
    const icon = largestIcon(applicationId, payload.stage);

    if (icon === undefined) {
        throw new Error(`Cannot build an AppImage without a ${applicationId} icon in the staged icon tree`);
    }

    return { rel: basename(icon.rel), abs: icon.abs };
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
