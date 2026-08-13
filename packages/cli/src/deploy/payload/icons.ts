import { basename, join } from "node:path";
import type { DeploySettings, StagedFile } from "../types.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { copyInto } from "./copy-tree.js";

const ICON_EXTENSIONS = [".svg", ".png", ".xpm"];
const SHARE_ICONS = "share/icons";
const SCALABLE_DIR = "hicolor/scalable/apps";
const SIZE_PATTERN = /^(?<width>[1-9]\d{0,3})x(?<height>[1-9]\d{0,3})$/;
const SIZE_SEPARATORS = /[-_.]/;

const isApplicationIcon = (settings: DeploySettings, rel: string): boolean =>
    ICON_EXTENSIONS.some((extension) => basename(rel) === `${settings.applicationId}${extension}`);

const getSquareSize = (token: string): number | null => {
    const groups = SIZE_PATTERN.exec(token)?.groups;

    if (groups === undefined || groups.width !== groups.height) {
        return null;
    }

    return Number(groups.width);
};

const firstSquareSize = (tokens: string[]): number | null =>
    tokens.map((token) => getSquareSize(token)).find((size) => size !== null) ?? null;

const getIconSize = (rel: string): number | null => firstSquareSize(rel.split("/").slice(0, -1));

const themeDirFor = (file: string): string => {
    if (file.endsWith(".svg")) {
        return SCALABLE_DIR;
    }

    const size = firstSquareSize(basename(file).split(SIZE_SEPARATORS));

    return size === null ? SCALABLE_DIR : `hicolor/${String(size)}x${String(size)}/apps`;
};

const stageIconTree = (root: string, iconsDir: string): StagedFile[] =>
    listFilesRecursive(iconsDir).map((file) => copyInto(root, join(SHARE_ICONS, file.rel), file.absPath));

const iconPathFor = (settings: DeploySettings, iconFile: string): string => {
    const extension = ICON_EXTENSIONS.find((candidate) => iconFile.endsWith(candidate)) ?? ".png";

    return join(themeDirFor(iconFile), `${settings.applicationId}${extension}`);
};

const stageIconFile = (settings: DeploySettings, root: string, iconFile: string): StagedFile[] =>
    [copyInto(root, join(SHARE_ICONS, iconPathFor(settings, iconFile)), iconFile)];

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

export { getIconSize, iconPathFor, stageIcons };
