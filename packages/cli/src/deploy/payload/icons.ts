import { basename, join } from "node:path";
import type { DeploySettings, StagedFile } from "../types.js";
import { relativeIconPath } from "../../internal/icon-path.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { copyInto } from "./copy-tree.js";

const ICON_EXTENSIONS = [".svg", ".png", ".xpm"];
const SHARE_ICONS = "share/icons";
const SIZE_PATTERN = /^(?<width>[1-9]\d{0,3})x(?<height>[1-9]\d{0,3})$/;

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

const stageIconTree = (root: string, iconsDir: string): StagedFile[] =>
    listFilesRecursive(iconsDir).map((file) => copyInto(root, join(SHARE_ICONS, file.rel), file.absPath));

const iconPathFor = (settings: DeploySettings, iconFile: string): string =>
    relativeIconPath(settings.applicationId, iconFile);

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
        `Set \`icons\` to a theme directory containing hicolor/scalable/apps/${settings.applicationId}.svg, ` +
        "or point it at a single icon file.",
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
