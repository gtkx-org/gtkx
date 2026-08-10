import { basename, join } from "node:path";
import type { DeploySettings, StagedFile } from "../types.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { copyInto } from "./copy-tree.js";

const ICON_EXTENSIONS = [".svg", ".png", ".xpm"];
const SHARE_ICONS = "share/icons";
const SCALABLE_DIR = "hicolor/scalable/apps";
const SIZE_PATTERN = /(?<size>[1-9]\d{0,3}x[1-9]\d{0,3})/;

const isApplicationIcon = (settings: DeploySettings, rel: string): boolean =>
    ICON_EXTENSIONS.some((extension) => basename(rel) === `${settings.applicationId}${extension}`);

const themeDirFor = (file: string): string => {
    if (file.endsWith(".svg")) {
        return SCALABLE_DIR;
    }

    const size = SIZE_PATTERN.exec(basename(file))?.groups?.size;

    return size === undefined ? SCALABLE_DIR : `hicolor/${size}/apps`;
};

const stageIconTree = (root: string, iconsDir: string): StagedFile[] =>
    listFilesRecursive(iconsDir).map((file) => copyInto(root, join(SHARE_ICONS, file.rel), file.absPath));

const stageIconFile = (settings: DeploySettings, root: string, iconFile: string): StagedFile[] => {
    const extension = ICON_EXTENSIONS.find((candidate) => iconFile.endsWith(candidate)) ?? ".png";
    const rel = join(SHARE_ICONS, themeDirFor(iconFile), `${settings.applicationId}${extension}`);

    return [copyInto(root, rel, iconFile)];
};

const assertApplicationIcon = (settings: DeploySettings, staged: StagedFile[]): void => {
    if (staged.some((file) => isApplicationIcon(settings, file.rel))) {
        return;
    }

    throw new Error(
        `Cannot deploy without an application icon: no ${settings.applicationId}.svg or ` +
        `${settings.applicationId}.png under ${settings.paths.iconsDir ?? "the project's icon directory"}. ` +
        "The desktop entry names " +
        `"${settings.applicationId}" as its icon, so the file has to match. ` +
        `Add ${settings.paths.dataDir ?? "data"}/icons/hicolor/scalable/apps/${settings.applicationId}.svg, ` +
        "or point `deploy.icons` at one.",
    );
};

const stageIcons = (settings: DeploySettings, root: string): StagedFile[] => {
    const { iconsDir, iconFile } = settings.paths;

    if (iconFile !== null) {
        return stageIconFile(settings, root, iconFile);
    }

    const staged = iconsDir === null ? [] : stageIconTree(root, iconsDir);
    assertApplicationIcon(settings, staged);

    return staged;
};

export { stageIcons };
